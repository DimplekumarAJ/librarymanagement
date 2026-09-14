import React, { useState, useMemo, useEffect, useRef, useContext, createContext, useCallback } from "react";
import {
  LayoutDashboard, Search, BookOpen, Bookmark, RotateCcw, Wallet, History,
  Bell, User, LogOut, Menu, X, Star, MapPin, CheckCircle2, AlertTriangle,
  XCircle, Clock, Filter, ChevronRight, ChevronLeft,
  Plus, Pencil, Trash2, Users, GraduationCap, Library, Receipt,
  Settings, Activity, BarChart3,
  TrendingUp, Building2, Mail, Phone, CreditCard, ArrowUpRight, ArrowDownRight,
  Eye, EyeOff, LayoutGrid, List as ListIcon, Camera, RefreshCw, Wifi
} from "lucide-react";
import { registerAccount, loginAccount, getBooks, addBook, updateBook, deleteBook, getReservations, addReservation, cancelReservation, getNotifications, markAllNotificationsRead } from "./api";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

/* ============================================================================
   DESIGN TOKENS
   Primary: Indigo 600 (#4F46E5) / Violet 600 (#7C3AED) gradient accent
   Surface: #FAFAFB page / #FFFFFF cards
   Semantic: green-600 success / amber-500 warning / red-600 error
============================================================================ */

const COLORS = {
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  violet: "#7C3AED",
  success: "#16A34A",
  successSoft: "#F0FDF4",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  error: "#DC2626",
  errorSoft: "#FEF2F2",
  slate: "#64748B",
};

const CATEGORY_COLORS = {
  "Computer Science": ["#4F46E5", "#7C3AED"],
  "Mathematics": ["#0EA5E9", "#4F46E5"],
  "Literature": ["#DB2777", "#7C3AED"],
  "Physics": ["#059669", "#0EA5E9"],
  "Business": ["#D97706", "#DB2777"],
  "Electronics": ["#7C3AED", "#4F46E5"],
  "Mechanical": ["#475569", "#0EA5E9"],
  "Civil Engineering": ["#B45309", "#D97706"],
};

const DEPARTMENTS = ["CSE", "ECE", "MECH", "CIVIL", "ISE", "MBA"];
const CATEGORIES = Object.keys(CATEGORY_COLORS);
const PIE_COLORS = ["#4F46E5", "#7C3AED", "#0EA5E9", "#059669", "#D97706", "#DB2777", "#475569", "#B45309"];
const ROLE_LABEL = { student: "Student", librarian: "Librarian", admin: "Administrator" };

/* ============================================================================
   SHARED PERSISTENT DATA LAYER
   Everything below reads/writes window.storage with shared=true so every
   student, librarian and admin using this app sees the same live catalogue,
   the same issue/return/reservation/fine records, and the same accounts.
============================================================================ */

const KEYS = {
  books: "lms_books_v2",
  accounts: "lms_accounts_v2",
  issues: "lms_issues_v2",
  reservations: "lms_reservations_v2",
  fines: "lms_fines_v2",
  notifications: "lms_notifications_v2",
  activity: "lms_activity_v2",
  settings: "lms_settings_v2",
  seeded: "lms_seeded_v2",
};

let uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

function initials(name) {
  return (name || "").split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h || 1;
}

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    if (!res || res.value === undefined || res.value === null) return fallback;
    return JSON.parse(res.value);
  } catch (e) {
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch (e) {
    console.error("storage save failed:", key, e);
    return false;
  }
}

async function loadPersonal(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    if (!res || res.value === undefined || res.value === null) return fallback;
    return JSON.parse(res.value);
  } catch (e) {
    return fallback;
  }
}
async function savePersonal(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) { /* ignore */ }
}
async function clearPersonal(key) {
  try {
    await window.storage.delete(key, false);
  } catch (e) { /* ignore */ }
}

/* ---------------------------- seed data ---------------------------------- */

const BOOKS_SEED = [
  { id: 1, title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", isbn: "978-0262046305", publisher: "MIT Press", edition: "4th", year: 2022, category: "Computer Science", department: "CSE", description: "The definitive guide to algorithms, covering design techniques, data structures, and complexity analysis used across modern computing.", totalCopies: 6, shelf: "CS-A12", rating: 4.7, reviews: 128 },
  { id: 2, title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", publisher: "Prentice Hall", edition: "1st", year: 2008, category: "Computer Science", department: "CSE", description: "A handbook of agile software craftsmanship, teaching principles for writing readable and maintainable code.", totalCopies: 6, shelf: "CS-A15", rating: 4.5, reviews: 96 },
  { id: 3, title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", isbn: "978-0078022159", publisher: "McGraw-Hill", edition: "7th", year: 2019, category: "Computer Science", department: "CSE", description: "Comprehensive coverage of database design, relational theory, transactions, and modern storage systems.", totalCopies: 4, shelf: "CS-B03", rating: 4.4, reviews: 74 },
  { id: 4, title: "Computer Networking: A Top-Down Approach", author: "Kurose & Ross", isbn: "978-0136681557", publisher: "Pearson", edition: "8th", year: 2021, category: "Computer Science", department: "ECE", description: "Explores networking from the application layer down, with real-world protocol examples throughout.", totalCopies: 3, shelf: "CS-B10", rating: 4.3, reviews: 58 },
  { id: 5, title: "Design Patterns", author: "Gamma, Helm, Johnson, Vlissides", isbn: "978-0201633610", publisher: "Addison-Wesley", edition: "1st", year: 1994, category: "Computer Science", department: "CSE", description: "The classic catalogue of reusable object-oriented design patterns, known as the Gang of Four book.", totalCopies: 4, shelf: "CS-A18", rating: 4.6, reviews: 112 },
  { id: 6, title: "Linear Algebra and Its Applications", author: "David C. Lay", isbn: "978-0321982384", publisher: "Pearson", edition: "5th", year: 2015, category: "Mathematics", department: "ISE", description: "A rigorous but accessible introduction to linear algebra with applications in engineering and data science.", totalCopies: 6, shelf: "MA-C01", rating: 4.2, reviews: 41 },
  { id: 7, title: "Probability and Statistics for Engineers", author: "Ronald E. Walpole", isbn: "978-0134115856", publisher: "Pearson", edition: "9th", year: 2016, category: "Mathematics", department: "MECH", description: "Foundational statistics text tailored for engineering problem solving and data analysis.", totalCopies: 5, shelf: "MA-C08", rating: 4.1, reviews: 33 },
  { id: 8, title: "Concepts of Physics Part I", author: "H.C. Verma", isbn: "978-8177091878", publisher: "Bharati Bhawan", edition: "2nd", year: 2013, category: "Physics", department: "ECE", description: "A widely used undergraduate physics text emphasizing conceptual clarity and problem solving.", totalCopies: 5, shelf: "PH-D02", rating: 4.6, reviews: 89 },
  { id: 9, title: "Microelectronic Circuits", author: "Sedra & Smith", isbn: "978-0190853464", publisher: "Oxford University Press", edition: "8th", year: 2019, category: "Electronics", department: "ECE", description: "A comprehensive treatment of analog and digital circuit design used widely in electronics curricula.", totalCopies: 4, shelf: "EC-E04", rating: 4.4, reviews: 47 },
  { id: 10, title: "Mechanics of Materials", author: "R.C. Hibbeler", isbn: "978-0134319650", publisher: "Pearson", edition: "10th", year: 2016, category: "Mechanical", department: "MECH", description: "Covers stress, strain, and material behavior with a strong emphasis on real engineering applications.", totalCopies: 4, shelf: "ME-F09", rating: 4.3, reviews: 39 },
  { id: 11, title: "Structural Analysis", author: "R.C. Hibbeler", isbn: "978-0134610672", publisher: "Pearson", edition: "10th", year: 2017, category: "Civil Engineering", department: "CIVIL", description: "A practical guide to analyzing determinate and indeterminate structures using classical and matrix methods.", totalCopies: 3, shelf: "CE-G02", rating: 4.2, reviews: 22 },
  { id: 12, title: "Principles of Marketing", author: "Philip Kotler, Gary Armstrong", isbn: "978-0134492513", publisher: "Pearson", edition: "17th", year: 2017, category: "Business", department: "MBA", description: "The leading introductory marketing text, blending theory with contemporary case studies.", totalCopies: 4, shelf: "BU-H01", rating: 4.0, reviews: 27 },
  { id: 13, title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0743273565", publisher: "Scribner", edition: "Reprint", year: 2004, category: "Literature", department: "ISE", description: "A classic portrait of the Jazz Age, exploring wealth, longing, and the American dream.", totalCopies: 3, shelf: "LT-J05", rating: 4.5, reviews: 64 },
  { id: 14, title: "Operating System Concepts", author: "Silberschatz, Galvin, Gagne", isbn: "978-1119800361", publisher: "Wiley", edition: "10th", year: 2021, category: "Computer Science", department: "CSE", description: "A thorough introduction to operating system design, from processes and memory to file systems.", totalCopies: 5, shelf: "CS-A20", rating: 4.5, reviews: 101 },
];

const ACCOUNTS_SEED = [
  { id: "admin-1", role: "admin", name: "Suresh Pillai", email: "suresh.p@ridgeview.edu", password: "admin123", joinedDate: "2022-06-01" },
  { id: "lib-1", role: "librarian", name: "Meera Krishnan", email: "meera.k@ridgeview.edu", password: "lib123", joinedDate: "2021-07-12" },
  { id: "lib-2", role: "librarian", name: "Vikram Shah", email: "vikram.s@ridgeview.edu", password: "lib123", joinedDate: "2023-01-20" },
  { id: "stu-1", role: "student", name: "Ananya Rao", usn: "1RV21CS045", email: "ananya.rao@rvce.college.edu", phone: "+91 98450 21763", department: "CSE", password: "student123", cardId: "LIB-CSE-2045", joinedDate: "2021-08-01" },
  { id: "stu-2", role: "student", name: "Rohit Sharma", usn: "1RV21EC012", email: "rohit.sharma@rvce.college.edu", phone: "+91 90000 10012", department: "ECE", password: "student123", cardId: "LIB-ECE-2012", joinedDate: "2021-08-01" },
  { id: "stu-3", role: "student", name: "Priya Nair", usn: "1RV21ME089", email: "priya.nair@rvce.college.edu", phone: "+91 90000 10089", department: "MECH", password: "student123", cardId: "LIB-MECH-2089", joinedDate: "2021-08-01" },
  { id: "stu-4", role: "student", name: "Karthik Iyer", usn: "1RV21CS102", email: "karthik.iyer@rvce.college.edu", phone: "+91 90000 10102", department: "CSE", password: "student123", cardId: "LIB-CSE-2102", joinedDate: "2021-08-01" },
  { id: "stu-5", role: "student", name: "Sneha Reddy", usn: "1RV21CV034", email: "sneha.reddy@rvce.college.edu", phone: "+91 90000 10034", department: "CIVIL", password: "student123", cardId: "LIB-CIVIL-2034", joinedDate: "2021-08-01" },
  { id: "stu-6", role: "student", name: "Aditya Verma", usn: "1RV21IS067", email: "aditya.verma@rvce.college.edu", phone: "+91 90000 10067", department: "ISE", password: "student123", cardId: "LIB-ISE-2067", joinedDate: "2021-08-01" },
  { id: "stu-7", role: "student", name: "Meera Joshi", usn: "1RV21MB021", email: "meera.joshi@rvce.college.edu", phone: "+91 90000 10021", department: "MBA", password: "student123", cardId: "LIB-MBA-2021", joinedDate: "2021-08-01" },
  { id: "stu-8", role: "student", name: "Farhan Khan", usn: "1RV21CS078", email: "farhan.khan@rvce.college.edu", phone: "+91 90000 10078", department: "CSE", password: "student123", cardId: "LIB-CSE-2078", joinedDate: "2021-08-01" },
];

// [bookId, studentId, issueDate, dueDate, returnDate|null]
const ISSUES_SEED_RAW = [
  [2, "stu-1", "2026-08-10", "2026-09-09", null],
  [8, "stu-1", "2026-07-28", "2026-08-27", null],
  [5, "stu-1", "2026-08-22", "2026-09-21", null],
  [4, "stu-2", "2026-08-25", "2026-09-08", null],
  [10, "stu-3", "2026-09-01", "2026-09-15", null],
  [13, "stu-3", "2026-08-20", "2026-09-03", null],
  [11, "stu-5", "2026-08-29", "2026-09-12", null],
  [7, "stu-5", "2026-08-20", "2026-09-03", null],
  [9, "stu-6", "2026-08-28", "2026-09-11", null],
  [6, "stu-7", "2026-08-18", "2026-09-01", null],
  [1, "stu-7", "2026-08-24", "2026-09-07", null],
  [3, "stu-7", "2026-08-30", "2026-09-13", null],
  [14, "stu-7", "2026-08-15", "2026-08-29", null],
  [1, "stu-8", "2026-08-12", "2026-08-26", null],
  [8, "stu-1", "2026-07-10", "2026-07-24", "2026-07-31"],
  [12, "stu-1", "2026-07-01", "2026-07-15", "2026-07-18"],
  [13, "stu-1", "2026-06-10", "2026-06-24", "2026-06-24"],
  [6, "stu-1", "2026-05-02", "2026-06-05", "2026-05-30"],
  [4, "stu-1", "2026-04-14", "2026-05-01", "2026-04-29"],
  [5, "stu-2", "2026-08-15", "2026-09-05", "2026-09-02"],
  [8, "stu-4", "2026-08-10", "2026-08-26", "2026-08-30"],
  [10, "stu-6", "2026-08-01", "2026-08-15", "2026-08-17"],
];

// [bookId, studentId, reservedOn, queuePosition, status]
const RESERVATIONS_SEED_RAW = [
  [1, "stu-1", "2026-08-30", 1, "Waiting"],
  [14, "stu-8", "2026-08-25", 1, "Ready for Pickup"],
  [2, "stu-3", "2026-09-01", 1, "Waiting"],
];

const ACTIVITY_SEED_RAW = [
  ["Added book \"Structural Analysis\" to the catalogue", "Meera Krishnan", "2026-09-04T09:00:00.000Z"],
  ["Updated the library fine policy", "Suresh Pillai", "2026-09-01T09:00:00.000Z"],
];

const SETTINGS_SEED = { loanDurationDays: 14, finePerDay: 5, maxBooksPerStudent: 5 };

function buildSeed() {
  const issues = ISSUES_SEED_RAW.map(([bookId, studentId, issueDate, dueDate, returnDate]) => ({
    id: uid("ISS"),
    bookId,
    studentId,
    issueDate,
    dueDate,
    returnDate,
    status: returnDate ? "Returned" : "Issued",
    renewCount: 0,
    issuedBy: { id: "lib-1", name: "Meera Krishnan" },
    returnedBy: returnDate ? { id: "lib-1", name: "Meera Krishnan" } : null,
  }));

  const fines = [];
  issues.forEach((iss) => {
    if (iss.returnDate) {
      const late = Math.max(0, daysBetween(iss.dueDate, iss.returnDate));
      if (late > 0) {
        fines.push({
          id: uid("FIN"),
          issueId: iss.id,
          bookId: iss.bookId,
          studentId: iss.studentId,
          dueDate: iss.dueDate,
          returnDate: iss.returnDate,
          lateDays: late,
          amount: late * SETTINGS_SEED.finePerDay,
          // First late Ananya fine stays unpaid, her second (Principles of Marketing) is paid, to mirror a realistic mixed ledger.
          status: iss.bookId === 12 ? "Paid" : "Unpaid",
        });
      }
    }
  });

  const books = BOOKS_SEED.map((b) => {
    const activeCount = issues.filter((i) => i.bookId === b.id && i.status !== "Returned").length;
    return { ...b, availableCopies: Math.max(0, b.totalCopies - activeCount) };
  });

  const reservations = RESERVATIONS_SEED_RAW.map(([bookId, studentId, reservedOn, queuePosition, status]) => ({
    id: uid("RES"), bookId, studentId, reservedOn, queuePosition, status,
  }));

  const notifications = [
    { id: uid("NOTIF"), userId: "stu-1", type: "due", message: "\"Clean Code\" is due on 2026-09-09.", time: "2026-09-05T10:00:00.000Z", read: false },
    { id: uid("NOTIF"), userId: "stu-1", type: "overdue", message: "\"Concepts of Physics Part I\" is overdue.", time: "2026-09-04T10:00:00.000Z", read: false },
    { id: uid("NOTIF"), userId: "stu-1", type: "reservation", message: "You are #1 in the queue for \"Introduction to Algorithms\".", time: "2026-08-30T10:00:00.000Z", read: true },
    { id: uid("NOTIF"), userId: "stu-8", type: "reservation", message: "\"Operating System Concepts\" is ready for pickup.", time: "2026-09-01T10:00:00.000Z", read: false },
  ];

  const activity = ACTIVITY_SEED_RAW.map(([action, by, time]) => ({ id: uid("ACT"), action, by, time }));

  return { books, accounts: ACCOUNTS_SEED, issues, reservations, fines, notifications, activity, settings: SETTINGS_SEED };
}

async function ensureSeeded() {
  const seeded = await loadKey(KEYS.seeded, false);
  if (seeded) return;
  const seed = buildSeed();
  await Promise.all([
    saveKey(KEYS.books, seed.books),
    saveKey(KEYS.accounts, seed.accounts),
    saveKey(KEYS.issues, seed.issues),
    saveKey(KEYS.reservations, seed.reservations),
    saveKey(KEYS.fines, seed.fines),
    saveKey(KEYS.notifications, seed.notifications),
    saveKey(KEYS.activity, seed.activity),
    saveKey(KEYS.settings, seed.settings),
  ]);
  await saveKey(KEYS.seeded, true);
}

/* ---------------------------- action helpers ------------------------------ */
// Every action re-reads the current shared state right before mutating it, so
// two people acting at nearly the same moment both land on a consistent
// (last-write-wins) result rather than clobbering each other from stale caches.

async function actionRegister({ role, name, idOrUsn, email, department, password }) {
  try {
    const account = await registerAccount({
      role,
      name: name.trim(),
      idOrUsn: idOrUsn.trim(),
      email: email.trim(),
      department,
      password
    });
    return account;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

async function actionLogin({ role, identifier, password }) {
  try {
    const account = await loginAccount({
      role,
      identifier: identifier.trim(),
      password
    });
    return account;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
}

async function pushNotification(userId, type, message) {
  const notifications = await loadKey(KEYS.notifications, []);
  notifications.unshift({ id: uid("NOTIF"), userId, type, message, time: new Date().toISOString(), read: false });
  await saveKey(KEYS.notifications, notifications);
}

async function pushActivity(action, by) {
  const activity = await loadKey(KEYS.activity, []);
  activity.unshift({ id: uid("ACT"), action, by, time: new Date().toISOString() });
  await saveKey(KEYS.activity, activity);
}

async function actionAddBook(bookData) {
  const book = await addBook({
    ...bookData,
    totalCopies: Number(bookData.totalCopies),
    year: Number(bookData.year || 0),
    rating: Number(bookData.rating || 0),
    reviews: Number(bookData.reviews || 0)
  });
  return book;
}

async function actionUpdateBook(bookId, patch) {
  const updated = await updateBook(bookId, {
    ...patch,
    totalCopies: patch.totalCopies !== undefined ? Number(patch.totalCopies) : undefined,
    year: patch.year !== undefined ? Number(patch.year) : undefined
  });
  return updated;
}

async function actionDeleteBook(bookId) {
  await deleteBook(bookId);
}

async function actionIssueBook({ studentId, bookId, dueDate, byAccount }) {
  const [books, issues, reservations] = await Promise.all([
    loadKey(KEYS.books, []), loadKey(KEYS.issues, []), loadKey(KEYS.reservations, []),
  ]);
  const bIdx = books.findIndex((b) => b.id === bookId);
  if (bIdx === -1) throw new Error("Book not found.");
  if (books[bIdx].availableCopies <= 0) throw new Error("No copies available to issue.");
  books[bIdx] = { ...books[bIdx], availableCopies: books[bIdx].availableCopies - 1 };

  const issue = {
    id: uid("ISS"), bookId, studentId,
    issueDate: todayStr(), dueDate, returnDate: null,
    status: "Issued", renewCount: 0,
    issuedBy: { id: byAccount.id, name: byAccount.name },
    returnedBy: null,
  };
  issues.push(issue);

  const remainingReservations = reservations.filter((r) => !(r.bookId === bookId && r.studentId === studentId));

  await Promise.all([
    saveKey(KEYS.books, books),
    saveKey(KEYS.issues, issues),
    saveKey(KEYS.reservations, remainingReservations),
  ]);
  await pushNotification(studentId, "due", `"${books[bIdx].title}" has been issued to you. Due ${dueDate}.`);
  await pushActivity(`Issued "${books[bIdx].title}" to a student`, byAccount.name);
  return issue;
}

async function actionReturnBook({ issueId, byAccount, finePerDay }) {
  const [issues, books, reservations, fines] = await Promise.all([
    loadKey(KEYS.issues, []), loadKey(KEYS.books, []), loadKey(KEYS.reservations, []), loadKey(KEYS.fines, []),
  ]);
  const iIdx = issues.findIndex((i) => i.id === issueId);
  if (iIdx === -1) throw new Error("Issue record not found.");
  const issue = issues[iIdx];
  if (issue.status === "Returned") throw new Error("This copy was already returned.");
  const returnDate = todayStr();
  const lateDays = Math.max(0, daysBetween(issue.dueDate, returnDate));
  issues[iIdx] = { ...issue, status: "Returned", returnDate, returnedBy: { id: byAccount.id, name: byAccount.name } };

  const bIdx = books.findIndex((b) => b.id === issue.bookId);
  if (bIdx !== -1) books[bIdx] = { ...books[bIdx], availableCopies: books[bIdx].availableCopies + 1 };

  let fine = null;
  if (lateDays > 0) {
    fine = {
      id: uid("FIN"), issueId: issue.id, bookId: issue.bookId, studentId: issue.studentId,
      dueDate: issue.dueDate, returnDate, lateDays, amount: lateDays * finePerDay, status: "Unpaid",
    };
    fines.push(fine);
  }

  // Promote the next reservation in line for this book, if any.
  const bookReservations = reservations
    .filter((r) => r.bookId === issue.bookId && r.status === "Waiting")
    .sort((a, b) => a.queuePosition - b.queuePosition);
  let promoted = null;
  if (bookReservations.length > 0) {
    promoted = bookReservations[0];
    const rIdx = reservations.findIndex((r) => r.id === promoted.id);
    reservations[rIdx] = { ...reservations[rIdx], status: "Ready for Pickup" };
  }

  await Promise.all([
    saveKey(KEYS.issues, issues),
    saveKey(KEYS.books, books),
    saveKey(KEYS.reservations, reservations),
    saveKey(KEYS.fines, fines),
  ]);

  const title = bIdx !== -1 ? books[bIdx].title : "the book";
  if (fine) await pushNotification(issue.studentId, "fine", `A fine of \u20b9${fine.amount} was generated for the late return of "${title}".`);
  if (promoted) await pushNotification(promoted.studentId, "reservation", `"${title}" is now ready for pickup.`);
  await pushActivity(`Processed return of "${title}"`, byAccount.name);
  return { issue: issues[iIdx], fine };
}

async function actionRenewBook({ issueId, studentId, days }) {
  const [issues, reservations] = await Promise.all([loadKey(KEYS.issues, []), loadKey(KEYS.reservations, [])]);
  const idx = issues.findIndex((i) => i.id === issueId && i.studentId === studentId);
  if (idx === -1) throw new Error("Issue record not found.");
  const issue = issues[idx];
  if (issue.status === "Returned") throw new Error("This book has already been returned.");
  if (daysBetween(issue.dueDate, todayStr()) > 0) throw new Error("Overdue books can't be renewed — please clear the fine first.");
  if (issue.renewCount >= 2) throw new Error("Renewal limit reached for this copy.");
  const waiting = reservations.some((r) => r.bookId === issue.bookId && r.status !== "Cancelled");
  if (waiting) throw new Error("Another student is waiting for this title, so it can't be renewed.");
  const newDue = addDays(issue.dueDate, days);
  issues[idx] = { ...issue, dueDate: newDue, renewCount: issue.renewCount + 1 };
  await saveKey(KEYS.issues, issues);
  return issues[idx];
}

async function actionReserveBook({ studentId, bookId }) {
  const reservation = await addReservation({
    book_id: Number(bookId),
    student_id: studentId,
    reserved_on: new Date().toISOString(),
  });
  return {
    id: reservation.id,
    bookId: Number(reservation.book_id ?? reservation.bookId),
    studentId: reservation.student_id ?? reservation.studentId,
    reservedOn: reservation.reserved_on ?? reservation.reservedOn,
    queuePosition: Number(reservation.queue_position ?? reservation.queuePosition ?? 0),
    status: reservation.status,
  };
}

async function actionCancelReservation({ reservationId }) {
  if (!reservationId) return;
  await cancelReservation(reservationId);
}

async function actionPayFine({ fineId }) {
  const fines = await loadKey(KEYS.fines, []);
  const idx = fines.findIndex((f) => f.id === fineId);
  if (idx === -1) return;
  fines[idx] = { ...fines[idx], status: "Paid" };
  await saveKey(KEYS.fines, fines);
}

async function actionMarkNotificationsRead(userId) {
  if (!userId) return;
  await markAllNotificationsRead(userId);
}

/* ---------------------------- data hook ----------------------------------- */

function useLibraryDB() {
  const [state, setState] = useState({
    books: [], accounts: [], issues: [], reservations: [], fines: [],
    notifications: [], activity: [], settings: SETTINGS_SEED, loaded: false, lastSync: null,
  });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [books, accounts, issues, reservations, fines, notifications, activity, settings] = await Promise.all([
        getBooks().then((rows) => (Array.isArray(rows) ? rows : []).map((b) => ({
          ...b,
          id: Number(b.id),
          year: Number(b.year),
          totalCopies: Number(b.total_copies ?? b.totalCopies ?? 0),
          availableCopies: Number(b.available_copies ?? b.availableCopies ?? 0),
          rating: Number(b.rating ?? 0),
          reviews: Number(b.reviews ?? 0),
          createdAt: b.created_at ?? b.createdAt ?? null,
        }))), loadKey(KEYS.accounts, []), loadKey(KEYS.issues, []),
        getReservations().then((rows) => (Array.isArray(rows) ? rows : []).map((r) => ({
          id: r.id,
          bookId: Number(r.book_id ?? r.bookId),
          studentId: r.student_id ?? r.studentId,
          reservedOn: r.reserved_on ?? r.reservedOn,
          queuePosition: Number(r.queue_position ?? r.queuePosition ?? 0),
          status: r.status,
        }))), loadKey(KEYS.fines, []),
        getNotifications().then((rows) => (Array.isArray(rows) ? rows : []).map((n) => ({
          id: n.id,
          userId: n.user_id ?? n.userId,
          type: String(n.type || "general").toLowerCase(),
          message: n.message,
          time: n.notification_time ?? n.time,
          read: Number(n.is_read ?? (n.read ? 1 : 0)) === 1,
        }))),
        loadKey(KEYS.activity, []), loadKey(KEYS.settings, SETTINGS_SEED),
      ]);
      setState({ books, accounts, issues, reservations, fines, notifications, activity, settings, loaded: true, lastSync: new Date() });
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      if (!cancelled) await refresh();
    })();
    const t = setInterval(refresh, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [refresh]);

  return { ...state, refresh };
}

const LibCtx = createContext(null);
function useLib() { return useContext(LibCtx); }

/* ============================================================================
   REUSABLE UI PRIMITIVES
============================================================================ */

function StatusBadge({ status }) {
  const map = {
    Issued: ["text-indigo-700", "bg-indigo-50"],
    "Due Soon": ["text-amber-700", "bg-amber-50"],
    Overdue: ["text-red-700", "bg-red-50"],
    Returned: ["text-green-700", "bg-green-50"],
    Waiting: ["text-amber-700", "bg-amber-50"],
    "Ready for Pickup": ["text-green-700", "bg-green-50"],
    Cancelled: ["text-gray-500", "bg-gray-100"],
    Paid: ["text-green-700", "bg-green-50"],
    Unpaid: ["text-red-700", "bg-red-50"],
    Available: ["text-green-700", "bg-green-50"],
    "Not Available": ["text-red-700", "bg-red-50"],
  };
  const [text, bg] = map[status] || ["text-slate-700", "bg-slate-100"];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${text} ${bg}`}>
      {status}
    </span>
  );
}

function BookCover({ book, size = "md" }) {
  if (!book) return <div className={size === "sm" ? "w-14 h-20" : "w-full aspect-[3/4]"} />;
  const [c1, c2] = CATEGORY_COLORS[book.category] || ["#4F46E5", "#7C3AED"];
  const dims = size === "lg" ? "w-full aspect-[3/4]" : size === "sm" ? "w-14 h-20" : "w-full aspect-[3/4]";
  return (
    <div
      className={`${dims} rounded-lg shrink-0 flex flex-col justify-between p-3 shadow-sm relative overflow-hidden`}
      style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/10" />
      <BookOpen className="w-4 h-4 text-white/70" />
      <div>
        <p className="text-white text-[11px] font-semibold leading-tight line-clamp-3">{book.title}</p>
        <p className="text-white/70 text-[9px] mt-1">{book.category}</p>
      </div>
    </div>
  );
}

function QRCode({ seed = 1, size = 88 }) {
  const cells = 9;
  const rng = (i) => {
    const x = Math.sin(seed * 999 + i * 37.13) * 10000;
    return x - Math.floor(x);
  };
  const cellSize = size / cells;
  const squares = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const isFinder =
        (r < 3 && c < 3) || (r < 3 && c > cells - 4) || (r > cells - 4 && c < 3);
      const on = isFinder ? (r === 1 && c === 1 ? false : true) : rng(r * cells + c) > 0.55;
      if (on) squares.push(<rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#312E81" />);
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md bg-white p-1 border border-gray-100">
      {squares}
    </svg>
  );
}

/* ---------------------------- real Code 39 barcode ------------------------
   Genuinely encodes the given text (not decorative) so a phone or a real
   barcode scanner running the camera scanner below can actually read it.
   Code 39 covers 0-9, A-Z, space and - . $ / + %, which is everything our
   USNs, card IDs and ISBNs use.
============================================================================ */
const CODE39_TABLE = {
  "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000",
  "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101",
  "8": "100100100", "9": "001100100", "A": "100001001", "B": "001001001",
  "C": "101001000", "D": "000011001", "E": "100011000", "F": "001011000",
  "G": "000001101", "H": "100001100", "I": "001001100", "J": "000011100",
  "K": "100000011", "L": "001000011", "M": "101000010", "N": "000010011",
  "O": "100010010", "P": "001010010", "Q": "000000111", "R": "100000110",
  "S": "001000110", "T": "000010110", "U": "110000001", "V": "011000001",
  "W": "111000000", "X": "010010001", "Y": "110010000", "Z": "011010000",
  "-": "010000101", ".": "110000100", " ": "011000100", "$": "010101000",
  "/": "010100010", "+": "010001010", "%": "000101010", "*": "010010100",
};

function code39Symbols(value) {
  const clean = ("" + value).toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "");
  const chars = ["*", ...clean.split(""), "*"];
  return chars.map((c) => CODE39_TABLE[c] || CODE39_TABLE["-"]);
}

function Barcode({ value = "", width = 200, height = 44 }) {
  const symbols = code39Symbols(value || "-");
  // Each symbol is 9 elements alternating bar/space, starting and ending on a bar;
  // a narrow element is 1 unit, a wide element ("1") is 2.5 units, with 1 unit gaps between symbols.
  let units = 0;
  symbols.forEach((s) => { for (const ch of s) units += ch === "1" ? 2.5 : 1; units += 1; });
  const unit = width / units;
  const rects = [];
  let x = 0;
  symbols.forEach((sym) => {
    for (let i = 0; i < sym.length; i++) {
      const w = (sym[i] === "1" ? 2.5 : 1) * unit;
      if (i % 2 === 0) rects.push(<rect key={`${x}-${i}`} x={x} y={0} width={w} height={height} fill="#1E1B4B" />);
      x += w;
    }
    x += unit; // inter-symbol gap
  });
  return (
    <div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>{rects}</svg>
      <p className="text-center text-[10px] tracking-widest text-gray-400 mt-1 font-mono">{("" + value).toUpperCase()}</p>
    </div>
  );
}

/* ---------------------------- live camera scanner -------------------------
   Uses the native BarcodeDetector API against the device camera. Falls back
   to manual code entry when the API or camera isn't available, so scanning
   always works one way or another.
============================================================================ */
function ScannerModal({ title, placeholder, onDetect, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState("starting"); // starting | live | unsupported | denied
  const detectorSupported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("unsupported"); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus(detectorSupported ? "live" : "unsupported");
        if (detectorSupported) {
          const detector = new window.BarcodeDetector({ formats: ["code_39", "code_128", "qr_code", "ean_13", "ean_8"] });
          const loop = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) { onDetect(codes[0].rawValue); return; }
            } catch (e) { /* keep trying */ }
            rafRef.current = requestAnimationFrame(loop);
          };
          rafRef.current = requestAnimationFrame(loop);
        }
      } catch (e) {
        if (!cancelled) setStatus("denied");
      }
    }
    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [detectorSupported, onDetect]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="font-semibold text-gray-900 text-sm">{title}</p>
          <button onClick={onClose}><X className="w-4.5 h-4.5 text-gray-500" /></button>
        </div>

        {status !== "unsupported" && status !== "denied" && (
          <div className="relative bg-black aspect-square">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-8 border-2 border-white/70 rounded-xl pointer-events-none" />
            {status === "starting" && <p className="absolute inset-0 flex items-center justify-center text-white text-sm">Starting camera…</p>}
            {status === "live" && <p className="absolute bottom-2 inset-x-0 text-center text-white/80 text-xs">Point at a library card or book barcode</p>}
          </div>
        )}
        {status === "denied" && (
          <div className="p-4 text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> Camera access was denied — enter the code manually below.</div>
        )}
        {status === "unsupported" && !detectorSupported && (
          <div className="p-4 text-sm text-amber-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> Live barcode scanning isn't supported in this browser — enter the code manually below.</div>
        )}

        <div className="p-4 space-y-2.5">
          <Field label="Or enter the code manually">
            <div className="flex gap-2">
              <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={placeholder} className={inputCls} onKeyDown={(e) => e.key === "Enter" && manual.trim() && onDetect(manual.trim())} />
              <button onClick={() => manual.trim() && onDetect(manual.trim())} className="px-4 rounded-xl text-white text-sm font-medium shrink-0" style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>Go</button>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 10 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)", width: size * 4, height: size * 4, fontSize: size * 1.3 }}
    >
      {initials(name)}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-indigo-500" />
      </div>
      <p className="font-semibold text-gray-800">{title}</p>
      <p className="text-sm text-gray-500 mt-1 max-w-xs">{subtitle}</p>
    </div>
  );
}

function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <h3 className="font-semibold text-gray-900 text-base">{dialog.title}</h3>
        <p className="text-sm text-gray-500 mt-1.5">{dialog.message}</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => { dialog.onConfirm(); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            {dialog.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const styles = {
    success: ["bg-green-600", CheckCircle2],
    error: ["bg-red-600", XCircle],
    warning: ["bg-amber-500", AlertTriangle],
  };
  const [bg, Icon] = styles[toast.type] || styles.success;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 w-full max-w-sm">
      <div className={`${bg} text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-2.5 text-sm font-medium`}>
        <Icon className="w-4.5 h-4.5 shrink-0" />
        {toast.message}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Pagination({ page, total, perPage, onChange }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onChange(page - 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: pages }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            className={`w-8 h-8 rounded-lg text-sm font-medium ${page === i + 1 ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50 border border-gray-200"}`}
          >
            {i + 1}
          </button>
        ))}
        <button disabled={page === pages} onClick={() => onChange(page + 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint = "indigo", trend }) {
  const tints = {
    indigo: ["bg-indigo-50", "text-indigo-600"],
    green: ["bg-green-50", "text-green-600"],
    amber: ["bg-amber-50", "text-amber-600"],
    red: ["bg-red-50", "text-red-600"],
    violet: ["bg-violet-50", "text-violet-600"],
    sky: ["bg-sky-50", "text-sky-600"],
  };
  const [bg, text] = tints[tint];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${text}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-3.5">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400";

/* ============================================================================
   NAV CONFIG
============================================================================ */

const NAV = {
  student: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "search", label: "Search Books", icon: Search },
    { key: "mybooks", label: "My Books", icon: BookOpen },
    { key: "reservations", label: "Reservations", icon: Bookmark },
    { key: "renew", label: "Renew Books", icon: RotateCcw },
    { key: "fines", label: "My Fines", icon: Wallet },
    { key: "history", label: "Borrowing History", icon: History },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "profile", label: "Profile", icon: User },
  ],
  librarian: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "books", label: "Books", icon: BookOpen },
    { key: "addbook", label: "Add Book", icon: Plus },
    { key: "issuereturn", label: "Issue / Return", icon: Camera },
    { key: "students", label: "Students", icon: Users },
    { key: "reservations", label: "Reservations", icon: Bookmark },
    { key: "fines", label: "Fines", icon: Wallet },
    { key: "reports", label: "Reports", icon: BarChart3 },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "users", label: "Users", icon: Users },
    { key: "students", label: "Students", icon: GraduationCap },
    { key: "librarians", label: "Librarians", icon: CreditCard },
    { key: "books", label: "Books", icon: BookOpen },
    { key: "categories", label: "Categories", icon: Filter },
    { key: "departments", label: "Departments", icon: Building2 },
    { key: "transactions", label: "Transactions", icon: Receipt },
    { key: "reservations", label: "Reservations", icon: Bookmark },
    { key: "fines", label: "Fines", icon: Wallet },
    { key: "reports", label: "Reports", icon: BarChart3 },
    { key: "logs", label: "Activity Logs", icon: Activity },
    { key: "settings", label: "Settings", icon: Settings },
  ],
};

/* ============================================================================
   LOGIN PAGE
============================================================================ */

const DEMO_HINTS = {
  student: "1RV21CS045 / student123",
  librarian: "meera.k@ridgeview.edu / lib123",
  admin: "suresh.p@ridgeview.edu / admin123",
};

function LoginPage({ onLogin }) {
  const [role, setRole] = useState("student");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState("signin"); // "signin" | "register" | "forgot"
  const [identifier, setIdentifier] = useState("1RV21CS045");
  const [password, setPassword] = useState("student123");
  const [signinError, setSigninError] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);

  const [regName, setRegName] = useState("");
  const [regId, setRegId] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regDept, setRegDept] = useState(DEPARTMENTS[0]);
  const [regPw, setRegPw] = useState("");
  const [regError, setRegError] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const switchRole = (r) => {
    setRole(r);
    setSigninError("");
    if (r === "student") { setIdentifier("1RV21CS045"); setPassword("student123"); }
    else if (r === "librarian") { setIdentifier("meera.k@ridgeview.edu"); setPassword("lib123"); }
    else { setIdentifier("suresh.p@ridgeview.edu"); setPassword("admin123"); }
  };

  const submitSignin = async () => {
    if (!identifier.trim() || !password.trim()) { setSigninError("Enter your ID/email and password."); return; }
    setSigninBusy(true);
    setSigninError("");
    try {
      const account = await actionLogin({ role, identifier, password });
      if (!account) { setSigninError("No account matches those credentials for this role."); return; }
      onLogin(account);
    } finally {
      setSigninBusy(false);
    }
  };

  const submitRegister = async () => {
    if (!regName.trim() || !regId.trim() || !regEmail.trim() || !regPw.trim()) {
      setRegError("Please fill in every field to continue.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) { setRegError("Enter a valid college email address."); return; }
    if (regPw.length < 6) { setRegError("Password must be at least 6 characters."); return; }
    setRegBusy(true);
    setRegError("");
    try {
      const account = await actionRegister({ role, name: regName, idOrUsn: regId, email: regEmail, department: regDept, password: regPw });
      onLogin(account);
    } catch (e) {
      setRegError(e.message || "Registration failed.");
    } finally {
      setRegBusy(false);
    }
  };

  if (mode === "register") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAFAFB] p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Library className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="font-semibold text-lg text-gray-900">Library Management System</span>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900">Create your account</h2>
          <p className="text-sm text-gray-500 mt-1.5">Register as {ROLE_LABEL[role].toLowerCase()} — this creates a real account stored in the shared library system.</p>

          {regError && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3.5 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {regError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <Field label="Full name">
              <input value={regName} onChange={(e) => setRegName(e.target.value)} className={inputCls} placeholder="e.g. Ananya Rao" />
            </Field>
            <Field label={role === "student" ? "USN" : "Staff ID"}>
              <input value={regId} onChange={(e) => setRegId(e.target.value)} className={inputCls} placeholder={role === "student" ? "e.g. 1RV23CS045" : "e.g. STF-2201"} />
            </Field>
            <Field label="College email">
              <input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} placeholder="you@college.edu" />
            </Field>
            <Field label="Department">
              <select value={regDept} onChange={(e) => setRegDept(e.target.value)} className={inputCls}>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={regPw} onChange={(e) => setRegPw(e.target.value)} className={inputCls + " pr-10"} placeholder="At least 6 characters" />
                <button onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <button
              onClick={submitRegister}
              disabled={regBusy}
              className="w-full py-3 rounded-xl text-white font-medium shadow-sm hover:opacity-95 transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
            >
              {regBusy ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-sm text-gray-500 pt-2">
              Already registered?{" "}
              <button onClick={() => { setMode("signin"); setRegError(""); }} className="text-indigo-600 font-medium hover:text-indigo-700">Sign in instead</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAFAFB] p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Library className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="font-semibold text-lg text-gray-900">Library Management System</span>
          </div>

          {!forgotSent ? (
            <>
              <h2 className="text-2xl font-semibold text-gray-900">Reset your password</h2>
              <p className="text-sm text-gray-500 mt-1.5">Enter your college email and we'll send a reset link.</p>
              <div className="mt-6 space-y-4">
                <Field label="College email">
                  <input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={inputCls} placeholder="you@college.edu" />
                </Field>
                <button
                  onClick={() => forgotEmail.trim() && setForgotSent(true)}
                  className="w-full py-3 rounded-xl text-white font-medium shadow-sm hover:opacity-95 transition"
                  style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
                >
                  Send reset link
                </button>
                <p className="text-center text-sm text-gray-500 pt-2">
                  <button onClick={() => setMode("signin")} className="text-indigo-600 font-medium hover:text-indigo-700">Back to sign in</button>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Check your inbox</h2>
              <p className="text-sm text-gray-500 mt-1.5">We've sent a password reset link to {forgotEmail}.</p>
              <button onClick={() => { setMode("signin"); setForgotSent(false); }} className="w-full mt-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-[#FAFAFB]">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#4F46E5,#7C3AED)" }}>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-black/10 -mb-20 -ml-20" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
              <Library className="w-5.5 h-5.5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Ridgeview College</span>
          </div>
          <div>
            <h1 className="text-4xl font-semibold leading-tight max-w-md">Everything the library offers, in one place.</h1>
            <p className="text-indigo-100 mt-4 max-w-sm">Search the catalogue, track due dates, and manage reservations — all synced live with the librarian and admin desks.</p>
            <div className="flex items-center gap-6 mt-10">
              <div>
                <p className="text-2xl font-semibold">{BOOKS_SEED.length} titles</p>
                <p className="text-indigo-200 text-sm">Catalogued at launch</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">Live sync</p>
                <p className="text-indigo-200 text-sm">Shared across every role</p>
              </div>
            </div>
          </div>
          <p className="text-indigo-200 text-xs">© 2026 Ridgeview College Library</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Library className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="font-semibold text-lg text-gray-900">Library Management System</span>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900">Sign in</h2>
          <p className="text-sm text-gray-500 mt-1.5">Access your library account to continue.</p>

          <div className="flex bg-gray-100 rounded-xl p-1 mt-6">
            {["student", "librarian", "admin"].map((r) => (
              <button
                key={r}
                onClick={() => switchRole(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${role === r ? "bg-white shadow-sm text-indigo-600" : "text-gray-500"}`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          {signinError && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3.5 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {signinError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <Field label={role === "student" ? "USN / Email" : "Email"}>
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputCls} placeholder={role === "student" ? "1RV21CS045 or you@college.edu" : "you@college.edu"} />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + " pr-10"} />
                <button onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <p className="text-xs text-gray-400">Demo login for {ROLE_LABEL[role].toLowerCase()}: {DEMO_HINTS[role]}</p>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
                Remember me
              </label>
              <button onClick={() => setMode("forgot")} className="text-indigo-600 font-medium hover:text-indigo-700">Forgot password?</button>
            </div>

            <button
              onClick={submitSignin}
              disabled={signinBusy}
              className="w-full py-3 rounded-xl text-white font-medium shadow-sm hover:opacity-95 transition disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
            >
              {signinBusy ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-sm text-gray-500 pt-2">
              New here? <button onClick={() => setMode("register")} className="text-indigo-600 font-medium hover:text-indigo-700">Create an account</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SHELL (SIDEBAR + TOPBAR)
============================================================================ */

function Shell({ role, page, setPage, onLogout, name, children, notifCount, onBell, lastSync }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[role];

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex">
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed lg:sticky top-0 h-screen w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Library className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">Library System</p>
            <p className="text-xs text-gray-400 leading-tight">Ridgeview College</p>
          </div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {items.map((item) => {
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setPage(item.key); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <item.icon className={`w-4.5 h-4.5 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-400">
          <Wifi className="w-3 h-3 text-green-500" />
          {lastSync ? `Synced ${lastSync.toLocaleTimeString()}` : "Syncing…"}
        </div>
        <div className="p-3 border-t border-gray-100">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            <LogOut className="w-4.5 h-4.5 text-gray-400" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur border-b border-gray-100 flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-500">
            <Menu className="w-5.5 h-5.5" />
          </button>
          <div className="relative hidden sm:block flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input placeholder="Quick search…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-100 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={onBell} className="relative w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-gray-500" />
              {notifCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />}
            </button>
            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
              <Avatar name={name} size={8} />
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-medium text-gray-800">{name}</p>
                <p className="text-xs text-gray-400">{ROLE_LABEL[role]}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

/* ============================================================================
   STUDENT PAGES
============================================================================ */

function bookById(books, id) { return books.find((b) => b.id === id); }
function accountById(accounts, id) { return accounts.find((a) => a.id === id); }

function computedIssueStatus(issue, today) {
  if (issue.status === "Returned") return "Returned";
  const remaining = daysBetween(today, issue.dueDate);
  if (remaining < 0) return "Overdue";
  if (remaining <= 3) return "Due Soon";
  return "Issued";
}

function StudentDashboard({ setPage, openBook }) {
  const { session, books, issues, reservations, fines, showToast } = useLib();
  const today = todayStr();
  const myIssues = issues.filter((i) => i.studentId === session.id && i.status !== "Returned");
  const myReservations = reservations.filter((r) => r.studentId === session.id && r.status !== "Cancelled");
  const myFinesUnpaid = fines.filter((f) => f.studentId === session.id && f.status === "Unpaid");
  const dueSoon = myIssues.filter((i) => ["Due Soon", "Overdue"].includes(computedIssueStatus(i, today))).length;

  const recentActivity = useMemo(() => {
    const events = [];
    issues.filter((i) => i.studentId === session.id).forEach((i) => {
      events.push({ icon: BookOpen, color: "text-indigo-600 bg-indigo-50", text: `Issued "${bookById(books, i.bookId)?.title || "a book"}"`, time: i.issueDate });
      if (i.returnDate) events.push({ icon: CheckCircle2, color: "text-green-600 bg-green-50", text: `Returned "${bookById(books, i.bookId)?.title || "a book"}"`, time: i.returnDate });
    });
    reservations.filter((r) => r.studentId === session.id).forEach((r) => {
      events.push({ icon: Bookmark, color: "text-violet-600 bg-violet-50", text: `Reserved "${bookById(books, r.bookId)?.title || "a book"}"`, time: r.reservedOn });
    });
    fines.filter((f) => f.studentId === session.id && f.status === "Paid").forEach((f) => {
      events.push({ icon: Wallet, color: "text-red-600 bg-red-50", text: `Fine of \u20b9${f.amount} paid`, time: f.returnDate });
    });
    return events.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 5);
  }, [issues, reservations, fines, books, session.id]);

  const recommended = useMemo(() => {
    const issuedIds = new Set(issues.filter((i) => i.studentId === session.id && i.status !== "Returned").map((i) => i.bookId));
    return books.filter((b) => !issuedIds.has(b.id)).sort((a, b) => b.rating - a.rating).slice(0, 4);
  }, [books, issues, session.id]);

  return (
    <div>
      <SectionHeader title={`Welcome back, ${session.name.split(" ")[0]}`} subtitle="Here's what's happening with your library account." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Books issued" value={myIssues.length} tint="indigo" />
        <StatCard icon={Clock} label="Due soon" value={dueSoon} tint="amber" />
        <StatCard icon={Bookmark} label="Active reservations" value={myReservations.length} tint="violet" />
        <StatCard icon={Wallet} label="Pending fines" value={`₹${myFinesUnpaid.reduce((s, f) => s + f.amount, 0)}`} tint="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Currently issued" subtitle="Renew before the due date to avoid fines." />
          {myIssues.length === 0 ? (
            <EmptyState icon={BookOpen} title="Nothing issued right now" subtitle="Search the catalogue to borrow a book." />
          ) : (
            <div className="space-y-3">
              {myIssues.map((item) => {
                const book = bookById(books, item.bookId);
                const remaining = daysBetween(today, item.dueDate);
                const status = computedIssueStatus(item, today);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                    <div className="w-10 h-14 shrink-0"><BookCover book={book} size="sm" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">{book?.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Due {item.dueDate} · {remaining >= 0 ? `${remaining} days left` : `${-remaining} days overdue`}</p>
                    </div>
                    <StatusBadge status={status} />
                    <button
                      onClick={async () => {
                        try { await actionRenewBook({ issueId: item.id, studentId: session.id, days: 14 }); showToast(`"${book?.title}" renewed for 14 days.`, "success"); }
                        catch (e) { showToast(e.message, "error"); }
                      }}
                      className="text-xs font-medium text-indigo-600 border border-indigo-100 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 shrink-0"
                    >
                      Renew
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => setPage("mybooks")} className="text-sm font-medium text-indigo-600 mt-3 flex items-center gap-1">
            View all my books <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Recent activity" />
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg ${a.color} flex items-center justify-center shrink-0`}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{a.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-5">
        <SectionHeader title="Recommended for you" subtitle="Highly rated titles you haven't borrowed yet." action={
          <button onClick={() => setPage("search")} className="text-sm font-medium text-indigo-600 flex items-center gap-1">Browse all <ChevronRight className="w-3.5 h-3.5" /></button>
        } />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {recommended.map((book) => (
            <button key={book.id} onClick={() => openBook(book.id)} className="text-left group">
              <BookCover book={book} />
              <p className="text-sm font-medium text-gray-900 mt-2 line-clamp-1 group-hover:text-indigo-600">{book.title}</p>
              <p className="text-xs text-gray-500">{book.author.split(",")[0]}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchBooks({ openBook, bookmarks, toggleBookmark }) {
  const { books } = useLib();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [availability, setAvailability] = useState("All");
  const [view, setView] = useState("grid");
  const [page, setPagination] = useState(1);
  const perPage = 8;

  const filtered = useMemo(() => {
    return books.filter((b) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.includes(q) || b.category.toLowerCase().includes(q) || b.department.toLowerCase().includes(q);
      const matchesCategory = category === "All" || b.category === category;
      const matchesAvailability =
        availability === "All" || (availability === "Available" ? b.availableCopies > 0 : b.availableCopies === 0);
      return matchesQuery && matchesCategory && matchesAvailability;
    });
  }, [books, query, category, availability]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <SectionHeader title="Search books" subtitle="Search the full catalogue by title, author, ISBN, subject or department." />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPagination(1); }}
            placeholder="Search by title, author, ISBN, subject or department…"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-1"><Filter className="w-3.5 h-3.5" /> Filters</div>
          {["All", "Available", "Not Available"].map((a) => (
            <button key={a} onClick={() => { setAvailability(a); setPagination(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${availability === a ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {a}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPagination(1); }} className="text-xs font-medium border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 focus:outline-none">
            <option>All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView("grid")} className={`p-1.5 rounded-md ${view === "grid" ? "bg-white shadow-sm" : ""}`}><LayoutGrid className="w-4 h-4 text-gray-500" /></button>
            <button onClick={() => setView("list")} className={`p-1.5 rounded-md ${view === "list" ? "bg-white shadow-sm" : ""}`}><ListIcon className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={Search} title="No books found" subtitle="Try adjusting your search terms or filters." /></div>
      ) : view === "grid" ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {paged.map((book) => (
              <div key={book.id} className="group relative">
                <button onClick={() => toggleBookmark(book.id)} className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
                  <Bookmark className={`w-3.5 h-3.5 ${bookmarks.has(book.id) ? "fill-indigo-600 text-indigo-600" : "text-gray-400"}`} />
                </button>
                <button onClick={() => openBook(book.id)} className="w-full text-left">
                  <BookCover book={book} />
                </button>
                <p className="text-sm font-medium text-gray-900 mt-2 line-clamp-1">{book.title}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{book.author.split(",")[0]}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <StatusBadge status={book.availableCopies > 0 ? "Available" : "Not Available"} />
                  <span className="text-xs text-gray-400">{book.availableCopies}/{book.totalCopies} copies</span>
                </div>
                <button onClick={() => openBook(book.id)} className="w-full mt-2 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-50">View details</button>
              </div>
            ))}
          </div>
          <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPagination} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {paged.map((book) => (
            <div key={book.id} className="flex items-center gap-4 p-4">
              <div className="w-12 h-16"><BookCover book={book} size="sm" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 text-sm truncate">{book.title}</p>
                <p className="text-xs text-gray-500">{book.author} · {book.category}</p>
              </div>
              <StatusBadge status={book.availableCopies > 0 ? "Available" : "Not Available"} />
              <button onClick={() => toggleBookmark(book.id)}><Bookmark className={`w-4 h-4 ${bookmarks.has(book.id) ? "fill-indigo-600 text-indigo-600" : "text-gray-400"}`} /></button>
              <button onClick={() => openBook(book.id)} className="text-xs font-medium text-indigo-600 border border-indigo-100 bg-indigo-50 px-3 py-1.5 rounded-lg">Details</button>
            </div>
          ))}
          <div className="p-4"><Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPagination} /></div>
        </div>
      )}
    </div>
  );
}

function BookDetailsModal({ bookId, onClose }) {
  const { session, books, issues, reservations, showToast, refresh } = useLib();
  const [busy, setBusy] = useState(false);
  if (!bookId) return null;
  const book = bookById(books, bookId);
  if (!book) return null;

  const alreadyIssued = issues.some((i) => i.bookId === bookId && i.studentId === session.id && i.status !== "Returned");
  const alreadyReserved = reservations.some((r) => r.bookId === bookId && r.studentId === session.id && r.status !== "Cancelled");

  const reserve = async () => {
    setBusy(true);
    try {
      const res = await actionReserveBook({ studentId: session.id, bookId });
      showToast(res.status === "Ready for Pickup" ? "Copy is ready — visit the desk to collect it." : "Added to the waitlist — you'll be notified.", "success");
      await refresh();
      onClose();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <p className="font-semibold text-gray-900">Book details</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"><X className="w-4.5 h-4.5 text-gray-500" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-[160px_1fr] gap-5">
          <div className="w-32 sm:w-full mx-auto sm:mx-0"><BookCover book={book} size="lg" /></div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{book.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{book.author}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(book.rating) ? "fill-amber-400" : ""}`} />)}
              </div>
              <span className="text-xs text-gray-500">{book.rating} ({book.reviews} reviews)</span>
            </div>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">{book.description}</p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
              <div><span className="text-gray-400">ISBN</span><p className="text-gray-800 font-medium">{book.isbn}</p></div>
              <div><span className="text-gray-400">Publisher</span><p className="text-gray-800 font-medium">{book.publisher}</p></div>
              <div><span className="text-gray-400">Edition</span><p className="text-gray-800 font-medium">{book.edition}</p></div>
              <div><span className="text-gray-400">Published</span><p className="text-gray-800 font-medium">{book.year}</p></div>
              <div><span className="text-gray-400">Category</span><p className="text-gray-800 font-medium">{book.category}</p></div>
              <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /><p className="text-gray-800 font-medium">Shelf {book.shelf}</p></div>
            </div>

            <div className="flex items-center gap-4 mt-4 p-3 bg-gray-50 rounded-xl text-sm">
              <p><span className="font-semibold text-gray-900">{book.totalCopies}</span> <span className="text-gray-500">total copies</span></p>
              <div className="w-px h-4 bg-gray-200" />
              <p><span className="font-semibold text-gray-900">{book.availableCopies}</span> <span className="text-gray-500">available now</span></p>
              <StatusBadge status={book.availableCopies > 0 ? "Available" : "Not Available"} />
            </div>

            {alreadyIssued ? (
              <p className="mt-5 text-sm text-indigo-600 font-medium">You already have this book issued.</p>
            ) : alreadyReserved ? (
              <p className="mt-5 text-sm text-amber-600 font-medium">You're already on the waitlist for this title.</p>
            ) : (
              <button
                onClick={reserve}
                disabled={busy}
                className="w-full sm:w-auto mt-5 px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
              >
                {busy ? "Reserving…" : "Reserve book"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MyBooks() {
  const { session, books, issues, showToast, refresh } = useLib();
  const today = todayStr();
  const mine = issues.filter((i) => i.studentId === session.id && i.status !== "Returned");
  return (
    <div>
      <SectionHeader title="My books" subtitle="Books currently borrowed on your account." />
      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={BookOpen} title="No books issued" subtitle="Head to Search Books to find something to borrow." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <span>Book</span><span>Issue date</span><span>Due date</span><span>Days left</span><span>Status</span><span></span>
          </div>
          <div className="divide-y divide-gray-100">
            {mine.map((item) => {
              const book = bookById(books, item.bookId);
              const remaining = daysBetween(today, item.dueDate);
              return (
                <div key={item.id} className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 sm:gap-4 px-5 py-4 items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-12"><BookCover book={book} size="sm" /></div>
                    <div className="min-w-0"><p className="font-medium text-gray-900 text-sm truncate">{book?.title}</p><p className="text-xs text-gray-500">{book?.author.split(",")[0]}</p></div>
                  </div>
                  <span className="text-sm text-gray-600">{item.issueDate}</span>
                  <span className="text-sm text-gray-600">{item.dueDate}</span>
                  <span className={`text-sm font-medium ${remaining < 0 ? "text-red-600" : remaining <= 3 ? "text-amber-600" : "text-gray-700"}`}>
                    {remaining >= 0 ? `${remaining} days` : `${-remaining} overdue`}
                  </span>
                  <StatusBadge status={computedIssueStatus(item, today)} />
                  <button
                    onClick={async () => {
                      try { await actionRenewBook({ issueId: item.id, studentId: session.id, days: 14 }); showToast("Renewed for 14 days.", "success"); await refresh(); }
                      catch (e) { showToast(e.message, "error"); }
                    }}
                    className="text-xs font-medium text-indigo-600 border border-indigo-100 bg-indigo-50 px-3 py-1.5 rounded-lg justify-self-start"
                  >
                    Renew
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Reservations() {
  const { session, books, reservations, showToast, refresh } = useLib();
  const mine = reservations.filter((r) => r.studentId === session.id && r.status !== "Cancelled");
  return (
    <div>
      <SectionHeader title="Reservations" subtitle="Track your place in the queue for reserved titles." />
      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={Bookmark} title="No reservations yet" subtitle="Reserve a book from the catalogue to see it here." /></div>
      ) : (
        <div className="space-y-3">
          {mine.map((r) => {
            const book = bookById(books, r.bookId);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <div className="w-12 h-16"><BookCover book={book} size="sm" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{book?.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Reserved on {r.reservedOn} · Queue position #{r.queuePosition}</p>
                </div>
                <StatusBadge status={r.status} />
                <button
                  onClick={async () => { await actionCancelReservation({ reservationId: r.id }); showToast("Reservation cancelled.", "warning"); await refresh(); }}
                  className="text-xs font-medium text-red-600 border border-red-100 bg-red-50 px-3 py-1.5 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RenewBooks() {
  const { session, books, issues, showToast, refresh } = useLib();
  const today = todayStr();
  const mine = issues.filter((i) => i.studentId === session.id && i.status !== "Returned");
  return (
    <div>
      <SectionHeader title="Renew books" subtitle="Extend your due date by 14 days if no one is waiting for the title." />
      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={RotateCcw} title="Nothing to renew" subtitle="You don't have any books issued right now." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {mine.map((item) => {
            const book = bookById(books, item.bookId);
            const blocked = daysBetween(item.dueDate, today) > 0;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3">
                <div className="w-14 h-20 shrink-0"><BookCover book={book} size="sm" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{book?.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Due {item.dueDate}</p>
                  {blocked ? (
                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Clear overdue fine before renewing</p>
                  ) : (
                    <button
                      onClick={async () => {
                        try { const upd = await actionRenewBook({ issueId: item.id, studentId: session.id, days: 14 }); showToast(`"${book?.title}" renewed to ${upd.dueDate}.`, "success"); await refresh(); }
                        catch (e) { showToast(e.message, "error"); }
                      }}
                      className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg mt-2 hover:bg-indigo-700"
                    >
                      Renew for 14 days
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fines() {
  const { session, books, fines, showToast, refresh } = useLib();
  const mine = fines.filter((f) => f.studentId === session.id);
  const totalUnpaid = mine.filter((f) => f.status === "Unpaid").reduce((s, f) => s + f.amount, 0);
  return (
    <div>
      <SectionHeader title="My fines" subtitle="Overdue charges and payment history." />
      {totalUnpaid > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><Wallet className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-sm font-medium text-gray-900">Outstanding balance</p><p className="text-xs text-gray-500">Settle at the library counter or online</p></div>
          </div>
          <p className="text-xl font-semibold text-red-600">₹{totalUnpaid}</p>
        </div>
      )}
      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={Wallet} title="No fines on record" subtitle="Return books on time to keep it that way." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <span>Book</span><span>Due date</span><span>Return date</span><span>Late days</span><span>Amount</span><span>Status</span>
          </div>
          <div className="divide-y divide-gray-100">
            {mine.map((f) => {
              const book = bookById(books, f.bookId);
              return (
                <div key={f.id} className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 sm:gap-4 px-5 py-4 items-center">
                  <p className="font-medium text-gray-900 text-sm">{book?.title}</p>
                  <span className="text-sm text-gray-600">{f.dueDate}</span>
                  <span className="text-sm text-gray-600">{f.returnDate}</span>
                  <span className="text-sm text-gray-600">{f.lateDays} days</span>
                  <span className="text-sm font-medium text-gray-900">₹{f.amount}</span>
                  {f.status === "Unpaid" ? (
                    <button
                      onClick={async () => { await actionPayFine({ fineId: f.id }); showToast("Fine paid successfully.", "success"); await refresh(); }}
                      className="justify-self-start text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                    >
                      Pay ₹{f.amount}
                    </button>
                  ) : (
                    <StatusBadge status={f.status} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BorrowingHistory() {
  const { session, books, issues } = useLib();
  const history = issues
    .filter((i) => i.studentId === session.id && i.status === "Returned")
    .sort((a, b) => (a.returnDate < b.returnDate ? 1 : -1));
  return (
    <div>
      <SectionHeader title="Borrowing history" subtitle="A record of everything you've borrowed and returned." />
      {history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={History} title="No history yet" subtitle="Returned books will show up here." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-4 p-4">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><CheckCircle2 className="w-4.5 h-4.5 text-green-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{bookById(books, h.bookId)?.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">Issued {h.issueDate} · Returned {h.returnDate}</p>
              </div>
              <StatusBadge status="Returned" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NOTIF_ICON_MAP = {
  due: [Clock, "text-amber-600 bg-amber-50"],
  overdue: [AlertTriangle, "text-red-600 bg-red-50"],
  reservation: [Bookmark, "text-violet-600 bg-violet-50"],
  fine: [Wallet, "text-red-600 bg-red-50"],
  renewal: [RotateCcw, "text-green-600 bg-green-50"],
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function NotificationsPage() {
  const { session, notifications, refresh } = useLib();
  const mine = notifications.filter((n) => n.userId === session.id).sort((a, b) => (a.time < b.time ? 1 : -1));
  return (
    <div>
      <SectionHeader title="Notifications" subtitle="Stay on top of due dates, fines and reservations." action={
        <button onClick={async () => { await actionMarkNotificationsRead(session.id); await refresh(); }} className="text-sm font-medium text-indigo-600">Mark all as read</button>
      } />
      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100"><EmptyState icon={Bell} title="You're all caught up" subtitle="New notifications will appear here." /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {mine.map((n) => {
            const [Icon, cls] = NOTIF_ICON_MAP[n.type] || [Bell, "text-gray-600 bg-gray-50"];
            return (
              <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? "bg-indigo-50/30" : ""}`}>
                <div className={`w-9 h-9 rounded-lg ${cls} flex items-center justify-center shrink-0`}><Icon className="w-4.5 h-4.5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.time)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationDropdown({ onClose }) {
  const { session, notifications } = useLib();
  const mine = notifications.filter((n) => n.userId === session.id).sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 5);
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute right-4 sm:right-8 top-16 w-[90vw] max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-gray-900 text-sm">Notifications</p>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {mine.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">Nothing new.</p>
          ) : mine.map((n) => {
            const [Icon, cls] = NOTIF_ICON_MAP[n.type] || [Bell, "text-gray-600 bg-gray-50"];
            return (
              <div key={n.id} className="flex gap-3 p-3.5">
                <div className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center shrink-0`}><Icon className="w-4 h-4" /></div>
                <div><p className="text-sm text-gray-800">{n.message}</p><p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.time)}</p></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const { session, issues, fines } = useLib();
  const booksIssued = issues.filter((i) => i.studentId === session.id && i.status !== "Returned").length;
  const unpaidFines = fines.filter((f) => f.studentId === session.id && f.status === "Unpaid").reduce((s, f) => s + f.amount, 0);
  return (
    <div>
      <SectionHeader title="My profile" subtitle="Your library membership details." />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-semibold" style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
            {initials(session.name)}
          </div>
          <h3 className="font-semibold text-gray-900 mt-4">{session.name}</h3>
          <p className="text-sm text-gray-500">{session.usn}</p>
          <div className="mt-4"><QRCode seed={session.id.length + booksIssued} size={110} /></div>
          <div className="mt-4"><Barcode value={session.cardId} width={180} height={44} /></div>
          <p className="text-xs text-gray-400 mt-1">Show this barcode at the desk — it's what the librarian's scanner reads.</p>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-900 mb-4">Personal & academic details</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              ["Department", session.department],
              ["Library card ID", session.cardId],
              ["Books currently issued", booksIssued],
              ["Outstanding fines", `₹${unpaidFines}`],
            ].map(([label, val]) => (
              <div key={label}><p className="text-xs text-gray-400">{label}</p><p className="text-sm font-medium text-gray-800 mt-1">{val}</p></div>
            ))}
            <div className="flex items-start gap-2"><Mail className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-xs text-gray-400">Email</p><p className="text-sm font-medium text-gray-800">{session.email}</p></div></div>
            <div className="flex items-start gap-2"><Phone className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-xs text-gray-400">Phone</p><p className="text-sm font-medium text-gray-800">{session.phone || "—"}</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   LIBRARIAN PAGES
============================================================================ */

function useCirculationStats() {
  const { books, accounts, issues, fines, reservations } = useLib();
  const today = todayStr();
  const totalCopies = books.reduce((s, b) => s + b.totalCopies, 0);
  const availableNow = books.reduce((s, b) => s + b.availableCopies, 0);
  const issuedToday = issues.filter((i) => i.issueDate === today).length;
  const returnedToday = issues.filter((i) => i.returnDate === today).length;
  const overdue = issues.filter((i) => i.status !== "Returned" && daysBetween(i.dueDate, today) > 0).length;
  const pendingFines = fines.filter((f) => f.status === "Unpaid").reduce((s, f) => s + f.amount, 0);
  const totalStudents = accounts.filter((a) => a.role === "student").length;
  const pendingReservations = reservations.filter((r) => r.status !== "Cancelled").length;
  return { totalCopies, availableNow, issuedToday, returnedToday, overdue, pendingFines, totalStudents, pendingReservations };
}

function LibrarianDashboard({ setPage }) {
  const { books, accounts, issues } = useLib();
  const stats = useCirculationStats();
  const feed = useMemo(() => {
    const rows = [];
    issues.forEach((i) => {
      rows.push({ id: i.id + "-issue", type: "Issue", book: bookById(books, i.bookId)?.title, student: accountById(accounts, i.studentId)?.name, date: i.issueDate });
      if (i.returnDate) rows.push({ id: i.id + "-return", type: "Return", book: bookById(books, i.bookId)?.title, student: accountById(accounts, i.studentId)?.name, date: i.returnDate });
    });
    return rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  }, [issues, books, accounts]);

  return (
    <div>
      <SectionHeader title="Librarian dashboard" subtitle="Live overview of circulation activity." />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Library} label="Total copies" value={stats.totalCopies} tint="indigo" />
        <StatCard icon={ArrowUpRight} label="Books issued today" value={stats.issuedToday} tint="violet" />
        <StatCard icon={ArrowDownRight} label="Books returned today" value={stats.returnedToday} tint="green" />
        <StatCard icon={GraduationCap} label="Total students" value={stats.totalStudents} tint="sky" />
        <StatCard icon={AlertTriangle} label="Overdue books" value={stats.overdue} tint="amber" />
        <StatCard icon={Wallet} label="Pending fines" value={`₹${stats.pendingFines}`} tint="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Recent transactions" action={<button onClick={() => setPage("issuereturn")} className="text-sm font-medium text-indigo-600 flex items-center gap-1">Issue / Return <ChevronRight className="w-3.5 h-3.5" /></button>} />
          {feed.length === 0 ? <p className="text-sm text-gray-400">No transactions yet.</p> : (
            <div className="divide-y divide-gray-100">
              {feed.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.type === "Issue" ? "bg-indigo-50 text-indigo-600" : "bg-green-50 text-green-600"}`}>
                    {t.type === "Issue" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{t.book}</p><p className="text-xs text-gray-500">{t.student} · {t.date}</p></div>
                  <span className={`text-xs font-medium ${t.type === "Issue" ? "text-indigo-600" : "text-green-600"}`}>{t.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Quick actions" />
          <div className="space-y-2.5">
            <button onClick={() => setPage("issuereturn")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left"><Camera className="w-4.5 h-4.5 text-indigo-600" /><span className="text-sm font-medium text-gray-800">Issue or return a book</span></button>
            <button onClick={() => setPage("addbook")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left"><Plus className="w-4.5 h-4.5 text-indigo-600" /><span className="text-sm font-medium text-gray-800">Add a new book</span></button>
            <button onClick={() => setPage("fines")} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left"><Wallet className="w-4.5 h-4.5 text-indigo-600" /><span className="text-sm font-medium text-gray-800">Review pending fines</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BooksTable({ onAdd, onEdit, showConfirm }) {
  const { books, showToast, refresh } = useLib();
  const [page, setPage] = useState(1);
  const perPage = 6;
  const paged = books.slice((page - 1) * perPage, page * perPage);
  return (
    <div>
      <SectionHeader title="Books" subtitle="Manage the full catalogue of physical copies." action={
        <button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}><Plus className="w-4 h-4" /> Add book</button>
      } />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left font-medium px-5 py-3">Title</th>
              <th className="text-left font-medium px-5 py-3">ISBN</th>
              <th className="text-left font-medium px-5 py-3">Category</th>
              <th className="text-left font-medium px-5 py-3">Shelf</th>
              <th className="text-left font-medium px-5 py-3">Copies</th>
              <th className="text-left font-medium px-5 py-3">Status</th>
              <th className="text-right font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/60">
                <td className="px-5 py-3.5"><p className="font-medium text-gray-900">{b.title}</p><p className="text-xs text-gray-500">{b.author.split(",")[0]}</p></td>
                <td className="px-5 py-3.5 text-gray-600">{b.isbn}</td>
                <td className="px-5 py-3.5 text-gray-600">{b.category}</td>
                <td className="px-5 py-3.5 text-gray-600">{b.shelf}</td>
                <td className="px-5 py-3.5 text-gray-600">{b.availableCopies}/{b.totalCopies}</td>
                <td className="px-5 py-3.5"><StatusBadge status={b.availableCopies > 0 ? "Available" : "Not Available"} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => onEdit(b)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button
                      onClick={() => showConfirm({
                        title: "Delete this book?",
                        message: `"${b.title}" will be permanently removed from the catalogue.`,
                        confirmLabel: "Delete",
                        onConfirm: async () => { await actionDeleteBook(b.id); showToast("Book deleted.", "success"); await refresh(); },
                      })}
                      className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5"><Pagination page={page} total={books.length} perPage={perPage} onChange={setPage} /></div>
      </div>
    </div>
  );
}

function BookFormModal({ book, onClose }) {
  const { showToast, refresh } = useLib();
  const isEdit = !!book;
  const [form, setForm] = useState({
    title: book?.title || "", author: book?.author || "", isbn: book?.isbn || "",
    publisher: book?.publisher || "", category: book?.category || CATEGORIES[0], department: book?.department || DEPARTMENTS[0],
    totalCopies: book?.totalCopies || 1, shelf: book?.shelf || "", description: book?.description || "", edition: book?.edition || "1st", year: book?.year || new Date().getFullYear(),
  });
  const [busy, setBusy] = useState(false);
  if (book === undefined) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim() || !form.author.trim() || !form.isbn.trim()) { showToast("Title, author and ISBN are required.", "error"); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await actionUpdateBook(book.id, { ...form, totalCopies: Number(form.totalCopies), year: Number(form.year) });
        showToast("Book updated successfully.", "success");
      } else {
        await actionAddBook({ ...form, totalCopies: Number(form.totalCopies), year: Number(form.year) });
        showToast("Book added to catalogue.", "success");
      }
      await refresh();
      onClose();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
          <p className="font-semibold text-gray-900">{isEdit ? "Edit book" : "Add new book"}</p>
          <button onClick={onClose}><X className="w-4.5 h-4.5 text-gray-500" /></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Title"><input className={inputCls} value={form.title} onChange={set("title")} placeholder="Book title" /></Field>
          <Field label="Author"><input className={inputCls} value={form.author} onChange={set("author")} placeholder="Author name" /></Field>
          <Field label="ISBN"><input className={inputCls} value={form.isbn} onChange={set("isbn")} placeholder="978-XXXXXXXXXX" /></Field>
          <Field label="Publisher"><input className={inputCls} value={form.publisher} onChange={set("publisher")} placeholder="Publisher" /></Field>
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Department">
            <select className={inputCls} value={form.department} onChange={set("department")}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
          </Field>
          <Field label="Total copies"><input type="number" min={isEdit ? book.totalCopies - book.availableCopies : 1} className={inputCls} value={form.totalCopies} onChange={set("totalCopies")} /></Field>
          <Field label="Shelf / rack number"><input className={inputCls} value={form.shelf} onChange={set("shelf")} placeholder="e.g. CS-A12" /></Field>
          <div className="sm:col-span-2">
            <Field label="Description"><textarea rows={3} className={inputCls} value={form.description} onChange={set("description")} placeholder="Short description…" /></Field>
          </div>
          {isEdit && (
            <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Barcode value={book.isbn} width={180} height={40} />
              <p className="text-xs text-gray-500">Real Code 39 barcode of this title's ISBN — scannable at Issue / Return.</p>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700">Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60" style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add book"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueReturn() {
  const { session, books, accounts, issues, fines, settings, showToast, refresh } = useLib();
  const [mode, setMode] = useState("issue");
  const [studentQ, setStudentQ] = useState("");
  const [bookQ, setBookQ] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [dueDate, setDueDate] = useState(addDays(todayStr(), settings.loanDurationDays));
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(null); // "student" | "book" | null
  const today = todayStr();

  const studentsWithStats = useMemo(() => accounts.filter((a) => a.role === "student").map((s) => ({
    ...s,
    booksIssued: issues.filter((i) => i.studentId === s.id && i.status !== "Returned").length,
    fines: fines.filter((f) => f.studentId === s.id && f.status === "Unpaid").reduce((sum, f) => sum + f.amount, 0),
  })), [accounts, issues, fines]);

  const handleStudentScan = useCallback((raw) => {
    setScanning(null);
    const code = raw.trim().toLowerCase();
    const found = studentsWithStats.find((s) =>
      (s.cardId && s.cardId.toLowerCase() === code) ||
      (s.usn && s.usn.toLowerCase() === code) ||
      s.id.toLowerCase() === code
    );
    if (found) { setSelectedStudent(found); setSelectedIssue(null); showToast(`Scanned ${found.name}'s card.`, "success"); }
    else showToast(`No student matches "${raw}".`, "error");
  }, [studentsWithStats, showToast]);

  const handleBookScan = useCallback((raw) => {
    setScanning(null);
    const code = raw.trim().replace(/[^0-9a-z]/gi, "").toLowerCase();
    const found = books.find((b) => b.isbn.replace(/[^0-9a-z]/gi, "").toLowerCase() === code || String(b.id) === raw.trim());
    if (found) { setSelectedBook(found); setSelectedIssue(null); showToast(`Scanned "${found.title}".`, "success"); }
    else showToast(`No book matches "${raw}".`, "error");
  }, [books, showToast]);

  const studentResults = studentsWithStats.filter((s) => !studentQ || s.name.toLowerCase().includes(studentQ.toLowerCase()) || (s.usn || "").toLowerCase().includes(studentQ.toLowerCase()));
  const bookResults = mode === "issue"
    ? books.filter((b) => b.availableCopies > 0 && (!bookQ || b.title.toLowerCase().includes(bookQ.toLowerCase()) || b.isbn.includes(bookQ)))
    : books.filter((b) => !bookQ || b.title.toLowerCase().includes(bookQ.toLowerCase()) || b.isbn.includes(bookQ));

  const activeIssuesForBook = selectedBook ? issues.filter((i) => i.bookId === selectedBook.id && i.status !== "Returned") : [];
  const activeIssuesForStudentBook = selectedStudent && selectedBook
    ? issues.filter((i) => i.bookId === selectedBook.id && i.studentId === selectedStudent.id && i.status !== "Returned")
    : [];

  const reset = () => { setSelectedStudent(null); setSelectedBook(null); setSelectedIssue(null); setStudentQ(""); setBookQ(""); setDueDate(addDays(todayStr(), settings.loanDurationDays)); };

  const returnInfo = selectedIssue ? {
    dueDate: selectedIssue.dueDate,
    overdueDays: Math.max(0, daysBetween(selectedIssue.dueDate, today)),
    fine: Math.max(0, daysBetween(selectedIssue.dueDate, today)) * settings.finePerDay,
  } : null;

  const confirmAction = async () => {
    setBusy(true);
    try {
      if (mode === "issue") {
        await actionIssueBook({ studentId: selectedStudent.id, bookId: selectedBook.id, dueDate, byAccount: session });
        showToast(`"${selectedBook.title}" issued to ${selectedStudent.name}.`, "success");
      } else {
        await actionReturnBook({ issueId: selectedIssue.id, byAccount: session, finePerDay: settings.finePerDay });
        showToast(`"${selectedBook.title}" returned successfully.`, "success");
      }
      await refresh();
      reset();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Issue / Return" subtitle="Search a student and a book to complete a live transaction." />

      <div className="flex bg-gray-100 rounded-xl p-1 max-w-xs mb-6">
        {["issue", "return"].map((m) => (
          <button key={m} onClick={() => { setMode(m); reset(); }} className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${mode === m ? "bg-white shadow-sm text-indigo-600" : "text-gray-500"}`}>{m} book</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">1</span> Search student</p>
            {!selectedStudent ? (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={studentQ} onChange={(e) => setStudentQ(e.target.value)} placeholder="Search by name or USN…" className={inputCls + " pl-9"} />
                  </div>
                  <button onClick={() => setScanning("student")} className="px-4 rounded-xl border border-gray-200 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 shrink-0"><Camera className="w-4 h-4" /> Scan card</button>
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {studentResults.map((s) => (
                    <button key={s.id} onClick={() => { setSelectedStudent(s); setSelectedBook(null); setSelectedIssue(null); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 text-left">
                      <Avatar name={s.name} size={7} />
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{s.name}</p><p className="text-xs text-gray-500">{s.usn} · {s.department}</p></div>
                    </button>
                  ))}
                  {studentResults.length === 0 && <p className="text-sm text-gray-400 p-3">No matching students.</p>}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <Avatar name={selectedStudent.name} size={9} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{selectedStudent.name}</p>
                  <p className="text-xs text-gray-500">{selectedStudent.usn} · {selectedStudent.department} · {selectedStudent.booksIssued} books issued</p>
                  {selectedStudent.fines > 0 && <p className="text-xs text-red-600 mt-0.5">₹{selectedStudent.fines} outstanding fine</p>}
                </div>
                <button onClick={() => { setSelectedStudent(null); setSelectedIssue(null); }} className="text-xs font-medium text-gray-500">Change</button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">2</span> Search book</p>
            {!selectedBook ? (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input value={bookQ} onChange={(e) => setBookQ(e.target.value)} placeholder="Search by title or ISBN…" className={inputCls + " pl-9"} />
                  </div>
                  <button onClick={() => setScanning("book")} className="px-4 rounded-xl border border-gray-200 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 shrink-0"><Camera className="w-4 h-4" /> Scan barcode</button>
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                  {bookResults.map((b) => (
                    <button key={b.id} onClick={() => setSelectedBook(b)} className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 text-left">
                      <div className="w-8 h-11 shrink-0"><BookCover book={b} size="sm" /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{b.title}</p><p className="text-xs text-gray-500">{mode === "issue" ? `${b.availableCopies} available` : b.isbn}</p></div>
                    </button>
                  ))}
                  {bookResults.length === 0 && <p className="text-sm text-gray-400 p-3">No matching books.</p>}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="w-10 h-14"><BookCover book={selectedBook} size="sm" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{selectedBook.title}</p>
                  {mode === "issue" ? (
                    <StatusBadge status={selectedBook.availableCopies > 0 ? "Available" : "Not Available"} />
                  ) : (
                    <p className="text-xs text-gray-500">{activeIssuesForBook.length} copy(ies) currently out</p>
                  )}
                </div>
                <button onClick={() => { setSelectedBook(null); setSelectedIssue(null); }} className="text-xs font-medium text-gray-500">Change</button>
              </div>
            )}
          </div>

          {mode === "issue" ? (
            selectedStudent && selectedBook && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">3</span> Select due date</p>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls + " max-w-xs"} />
              </div>
            )
          ) : (
            selectedStudent && selectedBook && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">3</span> Select the copy to return</p>
                {activeIssuesForStudentBook.length === 0 ? (
                  <p className="text-sm text-amber-600">This student has no active copy of this book issued.</p>
                ) : (
                  <div className="space-y-2">
                    {activeIssuesForStudentBook.map((iss) => (
                      <button key={iss.id} onClick={() => setSelectedIssue(iss)} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left ${selectedIssue?.id === iss.id ? "border-indigo-400 bg-indigo-50/50" : "border-gray-100 hover:bg-gray-50"}`}>
                        <span className="text-sm text-gray-700">Issued {iss.issueDate} · Due {iss.dueDate}</span>
                        <StatusBadge status={computedIssueStatus(iss, today)} />
                      </button>
                    ))}
                  </div>
                )}
                {selectedIssue && returnInfo && returnInfo.overdueDays > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-gray-500">Overdue days</p><p className="text-lg font-semibold text-amber-700">{returnInfo.overdueDays}</p></div>
                    <div><p className="text-xs text-gray-500">Fine to be charged</p><p className="text-lg font-semibold text-amber-700">₹{returnInfo.fine}</p></div>
                  </div>
                )}
              </div>
            )
          )}

          <button
            disabled={busy || !selectedStudent || !selectedBook || (mode === "return" && !selectedIssue)}
            onClick={confirmAction}
            className="w-full py-3 rounded-xl text-white text-sm font-medium disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}
          >
            {busy ? "Processing…" : `Confirm ${mode}`}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-fit">
          <p className="text-sm font-semibold text-gray-900 mb-3">Scanner</p>
          <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <Camera className="w-8 h-8 text-indigo-400" />
            <p className="text-xs text-gray-500 text-center">Use "Scan card" or "Scan barcode" above to open the camera and read a student's library card or a book's barcode directly.</p>
          </div>
          {selectedStudent && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">This student's card</p>
              <Barcode value={selectedStudent.cardId} width={220} height={44} />
            </div>
          )}
        </div>
      </div>

      {scanning === "student" && (
        <ScannerModal title="Scan student library card" placeholder="e.g. LIB-CSE-2045 or USN" onDetect={handleStudentScan} onClose={() => setScanning(null)} />
      )}
      {scanning === "book" && (
        <ScannerModal title="Scan book barcode" placeholder="e.g. ISBN" onDetect={handleBookScan} onClose={() => setScanning(null)} />
      )}
    </div>
  );
}

function LibrarianStudents() {
  const { accounts, issues, fines, showToast } = useLib();
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const list = useMemo(() => accounts.filter((a) => a.role === "student").map((s) => ({
    ...s,
    booksIssued: issues.filter((i) => i.studentId === s.id && i.status !== "Returned").length,
    fines: fines.filter((f) => f.studentId === s.id && f.status === "Unpaid").reduce((sum, f) => sum + f.amount, 0),
  })), [accounts, issues, fines]);
  const filtered = list.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.usn || "").toLowerCase().includes(q.toLowerCase()));

  const handleScan = (raw) => {
    setScanning(false);
    const code = raw.trim().toLowerCase();
    const found = list.find((s) => (s.cardId && s.cardId.toLowerCase() === code) || (s.usn && s.usn.toLowerCase() === code) || s.id.toLowerCase() === code);
    if (found) { setQ(found.usn || found.name); showToast(`Found ${found.name}.`, "success"); }
    else showToast(`No student matches "${raw}".`, "error");
  };

  return (
    <div>
      <SectionHeader title="Students" subtitle="All registered library members." />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" className={inputCls + " pl-9"} />
          </div>
          <button onClick={() => setScanning(true)} className="px-4 rounded-xl border border-gray-200 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 shrink-0"><Camera className="w-4 h-4" /> Scan card</button>
        </div>
        {scanning && <ScannerModal title="Scan student library card" placeholder="e.g. LIB-CSE-2045 or USN" onDetect={handleScan} onClose={() => setScanning(false)} />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide"><th className="text-left font-medium px-5 py-3">Student</th><th className="text-left font-medium px-5 py-3">USN</th><th className="text-left font-medium px-5 py-3">Department</th><th className="text-left font-medium px-5 py-3">Books issued</th><th className="text-left font-medium px-5 py-3">Fines</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={7} /><span className="font-medium text-gray-900">{s.name}</span></div></td>
                  <td className="px-5 py-3 text-gray-600">{s.usn}</td>
                  <td className="px-5 py-3 text-gray-600">{s.department}</td>
                  <td className="px-5 py-3 text-gray-600">{s.booksIssued}</td>
                  <td className="px-5 py-3">{s.fines > 0 ? <span className="text-red-600 font-medium">₹{s.fines}</span> : <span className="text-gray-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GenericTable({ title, subtitle, columns, rows }) {
  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">{columns.map((c) => <th key={c} className="text-left font-medium px-5 py-3">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td className="px-5 py-6 text-gray-400" colSpan={columns.length}>Nothing to show yet.</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/60">{row.map((cell, j) => <td key={j} className="px-5 py-3 text-gray-700">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LibrarianReservationsTable() {
  const { books, accounts, reservations } = useLib();
  const rows = reservations
    .filter((r) => r.status !== "Cancelled")
    .sort((a, b) => (a.reservedOn < b.reservedOn ? 1 : -1))
    .map((r) => [accountById(accounts, r.studentId)?.name, bookById(books, r.bookId)?.title, r.reservedOn, <StatusBadge status={r.status} />]);
  return <GenericTable title="Reservations" subtitle="All active reservation requests." columns={["Student", "Book", "Reserved on", "Status"]} rows={rows} />;
}

function FinesTable({ scope }) {
  const { books, accounts, fines, showToast, refresh } = useLib();
  const rows = fines
    .sort((a, b) => (a.returnDate < b.returnDate ? 1 : -1))
    .map((f) => [
      accountById(accounts, f.studentId)?.name,
      bookById(books, f.bookId)?.title,
      String(f.lateDays),
      `₹${f.amount}`,
      f.status === "Unpaid" ? (
        <button
          onClick={async () => { await actionPayFine({ fineId: f.id }); showToast("Fine marked as paid.", "success"); await refresh(); }}
          className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700"
        >
          Mark paid
        </button>
      ) : <StatusBadge status="Paid" />,
    ]);
  return <GenericTable title="Fines" subtitle={scope === "admin" ? "Institution-wide fine collection." : "Outstanding and settled fines across all students."} columns={["Student", "Book", "Late days", "Amount", "Status"]} rows={rows} />;
}

function ReportsTable() {
  const stats = useCirculationStats();
  const { issues } = useLib();
  const returnsToDate = issues.filter((i) => i.status === "Returned").length;
  const rows = [
    ["Circulation summary", `${issues.length} issues to date, ${returnsToDate} returned`, todayStr()],
    ["Overdue books report", `${stats.overdue} currently overdue`, todayStr()],
    ["Outstanding fines", `₹${stats.pendingFines} pending`, todayStr()],
  ];
  return <GenericTable title="Reports" subtitle="Live circulation and inventory snapshots." columns={["Report", "Detail", "Generated"]} rows={rows} />;
}

function LibrarianSettings() {
  const { settings, showToast, refresh } = useLib();
  const [form, setForm] = useState(settings);
  useEffect(() => { setForm(settings); }, [settings]);
  const save = async () => {
    await saveKey(KEYS.settings, { loanDurationDays: Number(form.loanDurationDays), finePerDay: Number(form.finePerDay), maxBooksPerStudent: Number(form.maxBooksPerStudent) });
    showToast("Settings saved for everyone.", "success");
    await refresh();
  };
  return (
    <div>
      <SectionHeader title="Settings" subtitle="Library-wide configuration — changes apply for every role immediately." />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-md space-y-4">
        <Field label="Loan duration (days)"><input type="number" className={inputCls} value={form.loanDurationDays} onChange={(e) => setForm((f) => ({ ...f, loanDurationDays: e.target.value }))} /></Field>
        <Field label="Fine per day (₹)"><input type="number" className={inputCls} value={form.finePerDay} onChange={(e) => setForm((f) => ({ ...f, finePerDay: e.target.value }))} /></Field>
        <Field label="Max books per student"><input type="number" className={inputCls} value={form.maxBooksPerStudent} onChange={(e) => setForm((f) => ({ ...f, maxBooksPerStudent: e.target.value }))} /></Field>
        <button onClick={save} className="w-full py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>Save settings</button>
      </div>
    </div>
  );
}

/* ============================================================================
   ADMIN PAGES
============================================================================ */

function AdminDashboard() {
  const { books, accounts, issues, fines, reservations } = useLib();
  const stats = useCirculationStats();

  const categoryDist = CATEGORIES.map((c) => ({ name: c, value: books.filter((b) => b.category === c).reduce((s, b) => s + b.totalCopies, 0) })).filter((c) => c.value > 0);

  const deptBorrowing = DEPARTMENTS.map((d) => ({
    name: d,
    books: issues.filter((i) => accountById(accounts, i.studentId)?.department === d).length,
  }));

  const mostBorrowed = useMemo(() => {
    const counts = {};
    issues.forEach((i) => { counts[i.bookId] = (counts[i.bookId] || 0) + 1; });
    return Object.entries(counts)
      .map(([bookId, count]) => ({ name: bookById(books, Number(bookId))?.title || "Unknown", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [issues, books]);

  const monthlyStats = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, month: d.toLocaleString("default", { month: "short" }) });
    }
    return months.map((m) => ({
      month: m.month,
      issued: issues.filter((i) => i.issueDate.startsWith(m.key)).length,
      returned: issues.filter((i) => i.returnDate && i.returnDate.startsWith(m.key)).length,
    }));
  }, [issues]);

  const totalUsers = accounts.length;
  const totalStudents = accounts.filter((a) => a.role === "student").length;
  const totalLibrarians = accounts.filter((a) => a.role === "librarian").length;
  const totalFines = fines.reduce((s, f) => s + f.amount, 0);

  return (
    <div>
      <SectionHeader title="Admin dashboard" subtitle="System-wide overview, synced live from every desk." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total users" value={totalUsers} tint="indigo" />
        <StatCard icon={GraduationCap} label="Total students" value={totalStudents} tint="sky" />
        <StatCard icon={CreditCard} label="Total librarians" value={totalLibrarians} tint="violet" />
        <StatCard icon={BookOpen} label="Total books" value={books.reduce((s, b) => s + b.totalCopies, 0)} tint="indigo" />
        <StatCard icon={Receipt} label="Issued books" value={issues.filter((i) => i.status !== "Returned").length} tint="green" />
        <StatCard icon={Wallet} label="Total fines" value={`₹${totalFines}`} tint="red" />
        <StatCard icon={Bookmark} label="Reservations" value={reservations.filter((r) => r.status !== "Cancelled").length} tint="amber" />
        <StatCard icon={Building2} label="Departments" value={DEPARTMENTS.length} tint="sky" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Monthly issue & return statistics" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyStats}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="issued" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3 }} name="Issued" />
              <Line type="monotone" dataKey="returned" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="4 3" name="Returned" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Books by category" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" verticalAlign="middle" align="right" />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Most borrowed books" />
          {mostBorrowed.length === 0 ? <p className="text-sm text-gray-400">No borrowing activity yet.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={mostBorrowed} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 13 }} />
                <Bar dataKey="count" fill="#4F46E5" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Department-wise borrowing" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptBorrowing}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 13 }} />
              <Bar dataKey="books" fill="#7C3AED" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ROOT APP
============================================================================ */

const SESSION_KEY = "lms_session_v2";

function AppShell() {
  const lib = useLib();
  const { session, setSession, showToast } = lib;
  const [page, setPage] = useState("dashboard");
  const [bookModal, setBookModal] = useState(undefined);
  const [editBook, setEditBook] = useState(undefined);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const login = async (account) => {
    setSession(account);
    setPage("dashboard");
    await savePersonal(SESSION_KEY, account.id);
  };

  const logout = async () => {
    setSession(null);
    await clearPersonal(SESSION_KEY);
  };

  const toggleBookmark = (id) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!session) return <LoginPage onLogin={login} />;

  const notifCount = lib.notifications.filter((n) => n.userId === session.id && !n.read).length;

  let content = null;
  if (session.role === "student") {
    content = {
      dashboard: <StudentDashboard setPage={setPage} openBook={setBookModal} />,
      search: <SearchBooks openBook={setBookModal} bookmarks={bookmarks} toggleBookmark={toggleBookmark} />,
      mybooks: <MyBooks />,
      reservations: <Reservations />,
      renew: <RenewBooks />,
      fines: <Fines />,
      history: <BorrowingHistory />,
      notifications: <NotificationsPage />,
      profile: <Profile />,
    }[page];
  } else if (session.role === "librarian") {
    content = {
      dashboard: <LibrarianDashboard setPage={setPage} />,
      books: <BooksTable onAdd={() => setEditBook(null)} onEdit={setEditBook} showConfirm={setConfirmDialog} />,
      addbook: <BookFormModal book={null} onClose={() => setPage("books")} />,
      issuereturn: <IssueReturn />,
      students: <LibrarianStudents />,
      reservations: <LibrarianReservationsTable />,
      fines: <FinesTable scope="librarian" />,
      reports: <ReportsTable />,
      notifications: <NotificationsPage />,
      settings: <LibrarianSettings />,
    }[page];
  } else {
    content = {
      dashboard: <AdminDashboard />,
      users: <GenericTable title="Users" subtitle="All system users across roles." columns={["Name", "Role", "Email", "Department"]} rows={lib.accounts.map((a) => [a.name, ROLE_LABEL[a.role], a.email, a.department || "—"])} />,
      students: <LibrarianStudents />,
      librarians: <GenericTable title="Librarians" subtitle="Staff with catalogue and circulation access." columns={["Name", "Email", "Issues handled", "Returns handled"]} rows={lib.accounts.filter((a) => a.role === "librarian").map((l) => [
        l.name, l.email,
        String(lib.issues.filter((i) => i.issuedBy?.id === l.id).length),
        String(lib.issues.filter((i) => i.returnedBy?.id === l.id).length),
      ])} />,
      books: <BooksTable onAdd={() => setEditBook(null)} onEdit={setEditBook} showConfirm={setConfirmDialog} />,
      categories: <GenericTable title="Categories" subtitle="Subject categories used across the catalogue." columns={["Category", "Total copies"]} rows={CATEGORIES.map((c) => [c, String(lib.books.filter((b) => b.category === c).reduce((s, b) => s + b.totalCopies, 0))])} />,
      departments: <GenericTable title="Departments" subtitle="Academic departments linked to the catalogue." columns={["Department", "Books borrowed (to date)"]} rows={DEPARTMENTS.map((d) => [d, String(lib.issues.filter((i) => accountById(lib.accounts, i.studentId)?.department === d).length)])} />,
      transactions: <GenericTable title="Transactions" subtitle="Full issue and return log." columns={["ID", "Student", "Book", "Type", "Date"]} rows={useMemo(() => {
        const rows = [];
        lib.issues.forEach((i) => {
          rows.push([i.id, accountById(lib.accounts, i.studentId)?.name, bookById(lib.books, i.bookId)?.title, "Issue", i.issueDate]);
          if (i.returnDate) rows.push([i.id, accountById(lib.accounts, i.studentId)?.name, bookById(lib.books, i.bookId)?.title, "Return", i.returnDate]);
        });
        return rows.sort((a, b) => (a[4] < b[4] ? 1 : -1));
      }, [lib.issues, lib.accounts, lib.books])} />,
      reservations: <LibrarianReservationsTable />,
      fines: <FinesTable scope="admin" />,
      reports: <ReportsTable />,
      logs: <GenericTable title="Activity logs" subtitle="Recent administrative actions." columns={["Action", "By", "Time"]} rows={lib.activity.slice(0, 25).map((a) => [a.action, a.by, timeAgo(a.time)])} />,
      settings: <GenericTable title="System settings" subtitle="Institution-wide configuration." columns={["Setting", "Value"]} rows={[["Loan duration", `${lib.settings.loanDurationDays} days`], ["Fine per day", `₹${lib.settings.finePerDay}`], ["Max books per student", String(lib.settings.maxBooksPerStudent)]]} />,
    }[page];
  }

  return (
    <Shell role={session.role} page={page} setPage={setPage} onLogout={logout} name={session.name} notifCount={notifCount} onBell={() => setNotifOpen(true)} lastSync={lib.lastSync}>
      {content}
      <BookDetailsModal bookId={bookModal} onClose={() => setBookModal(undefined)} />
      {editBook !== undefined && <BookFormModal book={editBook} onClose={() => setEditBook(undefined)} />}
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
      <Toast toast={lib.toast} />
    </Shell>
  );
}

export default function App() {
  const db = useLibraryDB();
  const [session, setSessionRaw] = useState(null);
  const [toast, setToast] = useState(null);
  const [restoring, setRestoring] = useState(true);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 3200);
  }, []);

  const setSession = useCallback((account) => {
    setSessionRaw(account);
  }, []);

  // Restore a previous session (per browser) once the account list has loaded.
  useEffect(() => {
    if (!db.loaded || session) return;
    (async () => {
      const savedId = await loadPersonal(SESSION_KEY, null);
      if (savedId) {
        const acct = db.accounts.find((a) => a.id === savedId);
        if (acct) setSessionRaw(acct);
      }
      setRestoring(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.loaded]);

  // Keep the session object fresh as shared account data changes (e.g. another
  // tab updates this same account) and log out gracefully if it's removed.
  useEffect(() => {
    if (!session || !db.loaded) return;

    // The authenticated account now comes from the MySQL backend.
    // Do not log the user out just because the legacy browser-storage
    // account list does not contain the MySQL account.
    const fresh = db.accounts.find((a) => a.id === session.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(session)) {
      setSessionRaw(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.accounts, db.loaded, session]);

  if (!db.loaded || restoring) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FAFAFB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center animate-pulse">
            <Library className="w-5.5 h-5.5 text-white" />
          </div>
          <p className="text-sm text-gray-500">Connecting to the shared library system…</p>
        </div>
      </div>
    );
  }

  return (
    <LibCtx.Provider value={{ ...db, session, setSession, showToast, toast }}>
      <AppShell />
    </LibCtx.Provider>
  );
}
