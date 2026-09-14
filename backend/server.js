const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = 5000;

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json());

// ==================================================
// MYSQL CONNECTION
// ==================================================

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "librarymanage",
    port: 3307
});

db.connect((err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully to librarymanage");
});

// ==================================================
// DATE HELPER - INDIA
// ==================================================

function todayIndia() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

// ==================================================
// BASIC
// ==================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Library Management Backend is running"
    });
});

app.get("/api/test-db", (req, res) => {
    db.query(
        "SELECT 1 AS connected",
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Database connection failed",
                    error: err.message
                });
            }

            res.json({
                success: true,
                message: "MySQL connected",
                result: results
            });
        }
    );
});

// ==================================================
// ACCOUNT MAPPER
// ==================================================

function mapAccount(row) {
    if (!row) return null;

    return {
        id: row.id,
        role: row.role,
        name: row.name,
        usn: row.usn || null,
        staffId: row.staff_id || null,
        email: row.email,
        phone: row.phone || null,
        department: row.department || null,
        cardId: row.card_id || null,
        joinedDate: row.joined_date
    };
}

// ==================================================
// GET ACCOUNTS
// ==================================================

app.get("/api/accounts", (req, res) => {

    db.query(
        "SELECT * FROM accounts ORDER BY id ASC",
        (err, rows) => {

            if (err) {
                console.error("Accounts error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch accounts",
                    error: err.message
                });
            }

            res.json({
                success: true,
                accounts: rows.map(mapAccount)
            });
        }
    );
});

// ==================================================
// REGISTER ACCOUNT
// ==================================================

app.post("/api/register", (req, res) => {

    const {
        id,
        idOrUsn,
        role,
        name,
        usn,
        staffId,
        email,
        phone,
        department,
        password,
        cardId,
        joinedDate
    } = req.body;

    // ------------------------------------------------
    // IMPORTANT:
    // Frontend sends idOrUsn.
    // Students -> USN
    // Librarian/Admin -> Staff ID
    // ------------------------------------------------

    const accountIdentifier =
        String(id || idOrUsn || "").trim();

    if (
        !accountIdentifier ||
        !role ||
        !name ||
        !email ||
        !password
    ) {
        return res.status(400).json({
            success: false,
            message: "ID, role, name, email and password are required"
        });
    }

    // Only these roles are allowed
    if (!["student", "librarian", "admin"].includes(role)) {
        return res.status(400).json({
            success: false,
            message: "Invalid role"
        });
    }

    // Student -> USN
    const finalUsn =
        role === "student"
            ? String(usn || accountIdentifier).trim()
            : null;

    // Librarian/Admin -> Staff ID
    const finalStaffId =
        role !== "student"
            ? String(staffId || accountIdentifier).trim()
            : null;

    // Database primary key
    const finalId =
        id && String(id).trim()
            ? String(id).trim()
            : `${role}-${Date.now()}`;

    const finalJoinedDate =
        joinedDate || todayIndia();

    // Card ID only for students
    const finalCardId =
        role === "student"
            ? (
                cardId ||
                `LIB-${department || "GEN"}-${Math.floor(
                    1000 + Math.random() * 9000
                )}`
            )
            : null;

    const sql = `
        INSERT INTO accounts
        (
            id,
            role,
            name,
            usn,
            staff_id,
            email,
            phone,
            department,
            password,
            card_id,
            joined_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        finalId,
        role,
        name.trim(),
        finalUsn,
        finalStaffId,
        email.trim(),
        phone || null,
        department || null,
        password,
        finalCardId,
        finalJoinedDate
    ];

    db.query(sql, values, (err) => {

        if (err) {

            console.error("REGISTER ERROR:", err);

            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    success: false,
                    message:
                        "USN, Staff ID or email already exists"
                });
            }

            return res.status(500).json({
                success: false,
                message: "Registration failed",
                error: err.message
            });
        }

        db.query(
            "SELECT * FROM accounts WHERE id = ? LIMIT 1",
            [finalId],
            (selectErr, rows) => {

                if (selectErr) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Account created but could not be loaded",
                        error: selectErr.message
                    });
                }

                res.status(201).json({
                    success: true,
                    message: "Account created successfully",
                    account: mapAccount(rows[0])
                });
            }
        );
    });
});

// ==================================================
// LOGIN
// ==================================================

app.post("/api/login", (req, res) => {

    const {
        role,
        identifier,
        password
    } = req.body;

    console.log("LOGIN REQUEST:", {
        role,
        identifier,
        password: "***"
    });

    if (!role || !identifier || !password) {
        return res.status(400).json({
            success: false,
            message:
                "Role, identifier and password are required"
        });
    }

    const cleanRole =
        String(role).trim().toLowerCase();

    const cleanIdentifier =
        String(identifier).trim().toLowerCase();

    // ------------------------------------------------
    // Student
    // ------------------------------------------------

    if (cleanRole === "student") {

        const sql = `
            SELECT *
            FROM accounts
            WHERE LOWER(TRIM(role)) = 'student'
            AND (
                LOWER(TRIM(id)) = ?
                OR LOWER(TRIM(usn)) = ?
                OR LOWER(TRIM(email)) = ?
                OR LOWER(TRIM(card_id)) = ?
            )
            LIMIT 1
        `;

        db.query(
            sql,
            [
                cleanIdentifier,
                cleanIdentifier,
                cleanIdentifier,
                cleanIdentifier
            ],
            checkLogin
        );

        return;
    }

    // ------------------------------------------------
    // Librarian / Admin
    // ------------------------------------------------

    if (
        cleanRole === "librarian" ||
        cleanRole === "admin" ||
        cleanRole === "administrator"
    ) {

        const databaseRole =
            cleanRole === "administrator"
                ? "admin"
                : cleanRole;

        const sql = `
            SELECT *
            FROM accounts
            WHERE LOWER(TRIM(role)) = ?
            AND (
                LOWER(TRIM(id)) = ?
                OR LOWER(TRIM(staff_id)) = ?
                OR LOWER(TRIM(email)) = ?
            )
            LIMIT 1
        `;

        db.query(
            sql,
            [
                databaseRole,
                cleanIdentifier,
                cleanIdentifier,
                cleanIdentifier
            ],
            checkLogin
        );

        return;
    }

    return res.status(400).json({
        success: false,
        message: "Invalid role"
    });

    // ------------------------------------------------
    // Check login result
    // ------------------------------------------------

    function checkLogin(err, rows) {

        if (err) {

            console.error("LOGIN ERROR:", err);

            return res.status(500).json({
                success: false,
                message: "Database error during login",
                error: err.message
            });
        }

        if (rows.length === 0) {

            return res.status(401).json({
                success: false,
                message:
                    "No account matches those credentials for this role"
            });
        }

        const account = rows[0];

        if (
            String(account.password) !==
            String(password)
        ) {

            return res.status(401).json({
                success: false,
                message: "Incorrect password"
            });
        }

        return res.json({
            success: true,
            message: "Login successful",
            account: mapAccount(account)
        });
    }
});

// ==================================================
// BOOK MAPPER
// ==================================================

function mapBook(row) {

    if (!row) return null;

    return {
        id: Number(row.id),
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        publisher: row.publisher,
        edition: row.edition,
        year: Number(row.year || 0),
        category: row.category,
        department: row.department,
        description: row.description,
        totalCopies: Number(row.total_copies || 0),
        availableCopies: Number(row.available_copies || 0),
        shelf: row.shelf,
        rating: Number(row.rating || 0),
        reviews: Number(row.reviews || 0),
        createdAt: row.created_at || null
    };
}

// ==================================================
// GET BOOKS
// ==================================================

app.get("/api/books", (req, res) => {

    db.query(
        "SELECT * FROM books ORDER BY id ASC",
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch books",
                    error: err.message
                });
            }

            res.json({
                success: true,
                books: rows.map(mapBook)
            });
        }
    );
});

// ==================================================
// ADD BOOK
// ==================================================

app.post("/api/books", (req, res) => {

    const {
        title,
        author,
        isbn,
        publisher,
        edition,
        year,
        category,
        department,
        description,
        totalCopies,
        shelf,
        rating,
        reviews
    } = req.body;

    if (!title || !author || !isbn) {
        return res.status(400).json({
            success: false,
            message:
                "Title, author and ISBN are required"
        });
    }

    const copies =
        Number(totalCopies || 0);

    const sql = `
        INSERT INTO books
        (
            title,
            author,
            isbn,
            publisher,
            edition,
            year,
            category,
            department,
            description,
            total_copies,
            available_copies,
            shelf,
            rating,
            reviews
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title,
            author,
            isbn,
            publisher || null,
            edition || null,
            Number(year || 0),
            category || null,
            department || null,
            description || null,
            copies,
            copies,
            shelf || null,
            Number(rating || 0),
            Number(reviews || 0)
        ],
        (err, result) => {

            if (err) {

                console.error("ADD BOOK ERROR:", err);

                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message:
                            "A book with this ISBN already exists"
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: "Failed to add book",
                    error: err.message
                });
            }

            db.query(
                "SELECT * FROM books WHERE id = ?",
                [result.insertId],
                (selectErr, rows) => {

                    if (selectErr) {
                        return res.status(500).json({
                            success: false,
                            message:
                                "Book added but could not be loaded"
                        });
                    }

                    res.status(201).json({
                        success: true,
                        message:
                            "Book added successfully",
                        book: mapBook(rows[0])
                    });
                }
            );
        }
    );
});

// ==================================================
// UPDATE BOOK
// ==================================================

app.put("/api/books/:id", (req, res) => {

    const bookId =
        Number(req.params.id);

    db.query(
        "SELECT * FROM books WHERE id = ?",
        [bookId],
        (findErr, rows) => {

            if (findErr) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to find book"
                });
            }

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Book not found"
                });
            }

            const oldBook = rows[0];

            const body = req.body;

            const title =
                body.title ?? oldBook.title;

            const author =
                body.author ?? oldBook.author;

            const isbn =
                body.isbn ?? oldBook.isbn;

            const publisher =
                body.publisher ?? oldBook.publisher;

            const edition =
                body.edition ?? oldBook.edition;

            const year =
                Number(body.year ?? oldBook.year ?? 0);

            const category =
                body.category ?? oldBook.category;

            const department =
                body.department ?? oldBook.department;

            const description =
                body.description ?? oldBook.description;

            const totalCopies =
                Number(
                    body.totalCopies ??
                    oldBook.total_copies ??
                    0
                );

            const oldTotal =
                Number(oldBook.total_copies || 0);

            const oldAvailable =
                Number(oldBook.available_copies || 0);

            const issuedCopies =
                Math.max(
                    0,
                    oldTotal - oldAvailable
                );

            const availableCopies =
                Math.max(
                    0,
                    totalCopies - issuedCopies
                );

            const shelf =
                body.shelf ?? oldBook.shelf;

            const rating =
                Number(
                    body.rating ??
                    oldBook.rating ??
                    0
                );

            const reviews =
                Number(
                    body.reviews ??
                    oldBook.reviews ??
                    0
                );

            const sql = `
                UPDATE books
                SET
                    title = ?,
                    author = ?,
                    isbn = ?,
                    publisher = ?,
                    edition = ?,
                    year = ?,
                    category = ?,
                    department = ?,
                    description = ?,
                    total_copies = ?,
                    available_copies = ?,
                    shelf = ?,
                    rating = ?,
                    reviews = ?
                WHERE id = ?
            `;

            db.query(
                sql,
                [
                    title,
                    author,
                    isbn,
                    publisher,
                    edition,
                    year,
                    category,
                    department,
                    description,
                    totalCopies,
                    availableCopies,
                    shelf,
                    rating,
                    reviews,
                    bookId
                ],
                (updateErr) => {

                    if (updateErr) {
                        return res.status(500).json({
                            success: false,
                            message:
                                "Failed to update book",
                            error: updateErr.message
                        });
                    }

                    db.query(
                        "SELECT * FROM books WHERE id = ?",
                        [bookId],
                        (selectErr, updatedRows) => {

                            res.json({
                                success: true,
                                message:
                                    "Book updated successfully",
                                book:
                                    mapBook(updatedRows[0])
                            });
                        }
                    );
                }
            );
        }
    );
});

// ==================================================
// DELETE BOOK
// ==================================================

app.delete("/api/books/:id", (req, res) => {

    const bookId =
        Number(req.params.id);

    db.query(
        "DELETE FROM books WHERE id = ?",
        [bookId],
        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Failed to delete book",
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Book not found"
                });
            }

            res.json({
                success: true,
                message: "Book deleted successfully"
            });
        }
    );
});

// ==================================================
// GET ALL ISSUES
// ==================================================

app.get("/api/issues", (req, res) => {

    const sql = `
        SELECT
            i.*,
            b.title AS book_title,
            b.author AS book_author,
            b.isbn AS book_isbn,
            a.name AS student_name,
            a.usn AS student_usn
        FROM issues i
        LEFT JOIN books b
            ON b.id = i.book_id
        LEFT JOIN accounts a
            ON a.id = i.student_id
        ORDER BY i.issue_date DESC
    `;

    db.query(
        sql,
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch issues",
                    error: err.message
                });
            }

            res.json({
                success: true,
                issues: rows
            });
        }
    );
});

// ==================================================
// GET STUDENT ISSUES
// ==================================================

app.get(
    "/api/issues/student/:studentId",
    (req, res) => {

        const studentId =
            req.params.studentId;

        const sql = `
            SELECT
                i.*,
                b.title AS book_title,
                b.author AS book_author,
                b.isbn AS book_isbn
            FROM issues i
            LEFT JOIN books b
                ON b.id = i.book_id
            WHERE i.student_id = ?
            ORDER BY i.issue_date DESC
        `;

        db.query(
            sql,
            [studentId],
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to fetch student books",
                        error: err.message
                    });
                }

                res.json({
                    success: true,
                    issues: rows
                });
            }
        );
    }
);

// ==================================================
// ISSUE BOOK
// ==================================================

app.post("/api/issues", (req, res) => {

    const studentId =
        req.body.student_id ??
        req.body.studentId;

    const bookId =
        req.body.book_id ??
        req.body.bookId;

    const dueDate =
        req.body.due_date ??
        req.body.dueDate;

    const issuedBy =
        req.body.issued_by ??
        req.body.issuedBy ??
        req.body.byAccount?.id ??
        null;

    const issuedByName =
        req.body.issued_by_name ??
        req.body.issuedByName ??
        req.body.byAccount?.name ??
        null;

    if (!studentId || !bookId || !dueDate) {

        return res.status(400).json({
            success: false,
            message:
                "Student, book and due date are required"
        });
    }

    const numericBookId =
        Number(bookId);

    const issueId =
        req.body.id ||
        `ISS-${Date.now()}-${Math.floor(
            Math.random() * 1000
        )}`;

    const issueDate =
        todayIndia();

    // Check student
    db.query(
        `
        SELECT *
        FROM accounts
        WHERE id = ?
        AND role = 'student'
        LIMIT 1
        `,
        [studentId],
        (studentErr, students) => {

            if (studentErr) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to check student",
                    error: studentErr.message
                });
            }

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found"
                });
            }

            // Check book
            db.query(
                `
                SELECT *
                FROM books
                WHERE id = ?
                LIMIT 1
                `,
                [numericBookId],
                (bookErr, books) => {

                    if (bookErr) {
                        return res.status(500).json({
                            success: false,
                            message:
                                "Failed to check book",
                            error: bookErr.message
                        });
                    }

                    if (books.length === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Book not found"
                        });
                    }

                    const book =
                        books[0];

                    if (
                        Number(book.available_copies) <= 0
                    ) {
                        return res.status(409).json({
                            success: false,
                            message:
                                "No copies available to issue"
                        });
                    }

                    // Check duplicate active issue
                    db.query(
                        `
                        SELECT id
                        FROM issues
                        WHERE student_id = ?
                        AND book_id = ?
                        AND status = 'Issued'
                        LIMIT 1
                        `,
                        [
                            studentId,
                            numericBookId
                        ],
                        (duplicateErr, duplicateRows) => {

                            if (duplicateErr) {
                                return res.status(500).json({
                                    success: false,
                                    message:
                                        "Failed to check existing issue"
                                });
                            }

                            if (
                                duplicateRows.length > 0
                            ) {
                                return res.status(409).json({
                                    success: false,
                                    message:
                                        "This student already has this book"
                                });
                            }

                            // Reduce available copies
                            db.query(
                                `
                                UPDATE books
                                SET available_copies =
                                    available_copies - 1
                                WHERE id = ?
                                AND available_copies > 0
                                `,
                                [numericBookId],
                                (updateErr, updateResult) => {

                                    if (updateErr) {
                                        return res.status(500).json({
                                            success: false,
                                            message:
                                                "Failed to update book availability",
                                            error:
                                                updateErr.message
                                        });
                                    }

                                    if (
                                        updateResult.affectedRows === 0
                                    ) {
                                        return res.status(409).json({
                                            success: false,
                                            message:
                                                "No copies available to issue"
                                        });
                                    }

                                    // Insert issue
                                    db.query(
                                        `
                                        INSERT INTO issues
                                        (
                                            id,
                                            book_id,
                                            student_id,
                                            issue_date,
                                            due_date,
                                            return_date,
                                            status,
                                            renew_count,
                                            issued_by,
                                            issued_by_name
                                        )
                                        VALUES
                                        (
                                            ?, ?, ?, ?, ?,
                                            NULL, 'Issued', 0, ?, ?
                                        )
                                        `,
                                        [
                                            issueId,
                                            numericBookId,
                                            studentId,
                                            issueDate,
                                            dueDate,
                                            issuedBy,
                                            issuedByName
                                        ],
                                        (insertErr) => {

                                            if (insertErr) {

                                                // Restore book
                                                db.query(
                                                    `
                                                    UPDATE books
                                                    SET available_copies =
                                                        available_copies + 1
                                                    WHERE id = ?
                                                    `,
                                                    [numericBookId]
                                                );

                                                return res.status(500).json({
                                                    success: false,
                                                    message:
                                                        "Failed to create issue record",
                                                    error:
                                                        insertErr.message
                                                });
                                            }

                                            // Remove reservation
                                            db.query(
                                                `
                                                DELETE FROM reservations
                                                WHERE student_id = ?
                                                AND book_id = ?
                                                `,
                                                [
                                                    studentId,
                                                    numericBookId
                                                ],
                                                () => {

                                                    db.query(
                                                        `
                                                        SELECT *
                                                        FROM issues
                                                        WHERE id = ?
                                                        LIMIT 1
                                                        `,
                                                        [issueId],
                                                        (selectErr, issueRows) => {

                                                            res.status(201).json({
                                                                success: true,
                                                                message:
                                                                    "Book issued successfully",
                                                                issue:
                                                                    issueRows[0]
                                                            });
                                                        }
                                                    );
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// ==================================================
// RETURN BOOK
// ==================================================

app.put(
    "/api/issues/:id/return",
    (req, res) => {

        const issueId =
            req.params.id;

        const byAccount =
            req.body.byAccount ||
            {};

        const returnedBy =
            req.body.returned_by ??
            req.body.returnedBy ??
            byAccount.id ??
            null;

        const returnedByName =
            req.body.returned_by_name ??
            req.body.returnedByName ??
            byAccount.name ??
            null;

        const finePerDay =
            Number(
                req.body.finePerDay ??
                5
            );

        db.query(
            `
            SELECT *
            FROM issues
            WHERE id = ?
            LIMIT 1
            `,
            [issueId],
            (findErr, rows) => {

                if (findErr) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to find issue",
                        error: findErr.message
                    });
                }

                if (rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message:
                            "Issue record not found"
                    });
                }

                const issue =
                    rows[0];

                if (issue.status === "Returned") {
                    return res.status(409).json({
                        success: false,
                        message:
                            "This book has already been returned"
                    });
                }

                const returnDate =
                    todayIndia();

                const due =
                    new Date(
                        issue.due_date
                    );

                const returned =
                    new Date(
                        `${returnDate}T00:00:00`
                    );

                let lateDays = 0;

                if (
                    !Number.isNaN(
                        due.getTime()
                    )
                ) {
                    lateDays =
                        Math.max(
                            0,
                            Math.ceil(
                                (
                                    returned.getTime() -
                                    due.getTime()
                                ) /
                                (
                                    1000 *
                                    60 *
                                    60 *
                                    24
                                )
                            )
                        );
                }

                const fineAmount =
                    lateDays *
                    finePerDay;

                // Update issue
                db.query(
                    `
                    UPDATE issues
                    SET
                        return_date = ?,
                        status = 'Returned',
                        returned_by = ?,
                        returned_by_name = ?
                    WHERE id = ?
                    `,
                    [
                        returnDate,
                        returnedBy,
                        returnedByName,
                        issueId
                    ],
                    (updateErr) => {

                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message:
                                    "Failed to return book",
                                error:
                                    updateErr.message
                            });
                        }

                        // Restore copy
                        db.query(
                            `
                            UPDATE books
                            SET available_copies =
                                available_copies + 1
                            WHERE id = ?
                            `,
                            [issue.book_id],
                            (bookErr) => {

                                if (bookErr) {
                                    return res.status(500).json({
                                        success: false,
                                        message:
                                            "Book returned but availability update failed",
                                        error:
                                            bookErr.message
                                    });
                                }

                                // Add fine if overdue
                                if (fineAmount > 0) {

                                    db.query(
                                        `
                                        INSERT INTO fines
                                        (
                                            issue_id,
                                            book_id,
                                            student_id,
                                            due_date,
                                            return_date,
                                            late_days,
                                            amount,
                                            status
                                        )
                                        VALUES
                                        (?, ?, ?, ?, ?, ?, ?, 'Unpaid')
                                        `,
                                        [
                                            issueId,
                                            issue.book_id,
                                            issue.student_id,
                                            issue.due_date,
                                            returnDate,
                                            lateDays,
                                            fineAmount
                                        ],
                                        (fineErr) => {

                                            if (fineErr) {
                                                console.error(
                                                    "Fine insert error:",
                                                    fineErr.message
                                                );
                                            }

                                            sendReturnResponse();
                                        }
                                    );

                                } else {
                                    sendReturnResponse();
                                }

                                function sendReturnResponse() {

                                    db.query(
                                        `
                                        SELECT *
                                        FROM issues
                                        WHERE id = ?
                                        LIMIT 1
                                        `,
                                        [issueId],
                                        (selectErr, issueRows) => {

                                            res.json({
                                                success: true,
                                                message:
                                                    "Book returned successfully",
                                                issue:
                                                    issueRows[0],
                                                fine: {
                                                    lateDays,
                                                    amount:
                                                        fineAmount
                                                }
                                            });
                                        }
                                    );
                                }
                            }
                        );
                    }
                );
            }
        );
    }
);

// ==================================================
// RENEW BOOK
// ==================================================

app.put(
    "/api/issues/:id/renew",
    (req, res) => {

        const issueId =
            req.params.id;

        const studentId =
            req.body.student_id ??
            req.body.studentId;

        const dueDate =
            req.body.due_date ??
            req.body.dueDate;

        if (!studentId || !dueDate) {
            return res.status(400).json({
                success: false,
                message:
                    "Student ID and new due date are required"
            });
        }

        db.query(
            `
            SELECT *
            FROM issues
            WHERE id = ?
            AND student_id = ?
            LIMIT 1
            `,
            [
                issueId,
                studentId
            ],
            (err, rows) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to find issue"
                    });
                }

                if (rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message:
                            "Issue record not found"
                    });
                }

                const issue =
                    rows[0];

                if (
                    issue.status === "Returned"
                ) {
                    return res.status(409).json({
                        success: false,
                        message:
                            "This book has already been returned"
                    });
                }

                if (
                    Number(issue.renew_count || 0) >= 2
                ) {
                    return res.status(409).json({
                        success: false,
                        message:
                            "Renewal limit reached for this book"
                    });
                }

                db.query(
                    `
                    SELECT id
                    FROM reservations
                    WHERE book_id = ?
                    AND status = 'Waiting'
                    AND student_id <> ?
                    LIMIT 1
                    `,
                    [
                        issue.book_id,
                        studentId
                    ],
                    (reservationErr, waitingRows) => {

                        if (
                            reservationErr
                        ) {
                            console.error(
                                reservationErr.message
                            );
                        }

                        if (
                            waitingRows &&
                            waitingRows.length > 0
                        ) {
                            return res.status(409).json({
                                success: false,
                                message:
                                    "Another student is waiting for this book"
                            });
                        }

                        db.query(
                            `
                            UPDATE issues
                            SET
                                due_date = ?,
                                renew_count =
                                    renew_count + 1
                            WHERE id = ?
                            `,
                            [
                                dueDate,
                                issueId
                            ],
                            (updateErr) => {

                                if (updateErr) {
                                    return res.status(500).json({
                                        success: false,
                                        message:
                                            "Failed to renew book",
                                        error:
                                            updateErr.message
                                    });
                                }

                                db.query(
                                    `
                                    SELECT *
                                    FROM issues
                                    WHERE id = ?
                                    LIMIT 1
                                    `,
                                    [issueId],
                                    (selectErr, updatedRows) => {

                                        res.json({
                                            success: true,
                                            message:
                                                "Book renewed successfully",
                                            issue:
                                                updatedRows[0]
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// ==================================================
// RESERVATIONS
// ==================================================

app.get(
    "/api/reservations",
    (req, res) => {

        db.query(
            `
            SELECT *
            FROM reservations
            ORDER BY reserved_on DESC
            `,
            (err, rows) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to load reservations",
                        error:
                            err.message
                    });
                }

                res.json({
                    success: true,
                    reservations: rows
                });
            }
        );
    }
);

// ==================================================
// ADD RESERVATION
// ==================================================

app.post(
    "/api/reservations",
    (req, res) => {

        const id =
            req.body.id;

        const bookId =
            req.body.book_id ??
            req.body.bookId;

        const studentId =
            req.body.student_id ??
            req.body.studentId;

        const reservedOn =
            req.body.reserved_on ??
            req.body.reservedOn ??
            todayIndia();

        const queuePosition =
            Number(
                req.body.queue_position ??
                req.body.queuePosition ??
                1
            );

        const status =
            req.body.status ||
            "Waiting";

        if (!id || !bookId || !studentId) {
            return res.status(400).json({
                success: false,
                message:
                    "id, bookId and studentId are required"
            });
        }

        db.query(
            `
            SELECT id
            FROM reservations
            WHERE book_id = ?
            AND student_id = ?
            AND status <> 'Cancelled'
            LIMIT 1
            `,
            [
                Number(bookId),
                studentId
            ],
            (checkErr, existing) => {

                if (checkErr) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to check reservation"
                    });
                }

                if (existing.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message:
                            "You already have an active reservation for this book."
                    });
                }

                db.query(
                    `
                    INSERT INTO reservations
                    (
                        id,
                        book_id,
                        student_id,
                        reserved_on,
                        queue_position,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        id,
                        Number(bookId),
                        studentId,
                        reservedOn,
                        queuePosition,
                        status
                    ],
                    (insertErr) => {

                        if (insertErr) {
                            return res.status(500).json({
                                success: false,
                                message:
                                    "Failed to create reservation",
                                error:
                                    insertErr.message
                            });
                        }

                        db.query(
                            `
                            SELECT *
                            FROM reservations
                            WHERE id = ?
                            LIMIT 1
                            `,
                            [id],
                            (selectErr, rows) => {

                                res.status(201).json({
                                    success: true,
                                    message:
                                        "Reservation created successfully",
                                    reservation:
                                        rows[0]
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);

// ==================================================
// CANCEL RESERVATION
// ==================================================

app.put(
    "/api/reservations/:id/cancel",
    (req, res) => {

        const id =
            req.params.id;

        db.query(
            `
            UPDATE reservations
            SET status = 'Cancelled'
            WHERE id = ?
            AND status <> 'Cancelled'
            `,
            [id],
            (err, result) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to cancel reservation",
                        error:
                            err.message
                    });
                }

                if (
                    result.affectedRows === 0
                ) {
                    return res.status(404).json({
                        success: false,
                        message:
                            "Active reservation not found"
                    });
                }

                db.query(
                    `
                    SELECT *
                    FROM reservations
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [id],
                    (selectErr, rows) => {

                        res.json({
                            success: true,
                            message:
                                "Reservation cancelled successfully",
                            reservation:
                                rows[0]
                        });
                    }
                );
            }
        );
    }
);

// ==================================================
// FINES
// ==================================================

app.get("/api/fines", (req, res) => {

    db.query(
        `
        SELECT *
        FROM fines
        ORDER BY id DESC
        `,
        (err, rows) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to fetch fines",
                    error:
                        err.message
                });
            }

            res.json({
                success: true,
                fines: rows
            });
        }
    );
});

// ==================================================
// STUDENT FINES
// ==================================================

app.get(
    "/api/fines/student/:studentId",
    (req, res) => {

        db.query(
            `
            SELECT *
            FROM fines
            WHERE student_id = ?
            ORDER BY id DESC
            `,
            [req.params.studentId],
            (err, rows) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to fetch student fines",
                        error:
                            err.message
                    });
                }

                res.json({
                    success: true,
                    fines: rows
                });
            }
        );
    }
);

// ==================================================
// PAY FINE
// ==================================================

app.put(
    "/api/fines/:id/pay",
    (req, res) => {

        db.query(
            `
            UPDATE fines
            SET status = 'Paid'
            WHERE id = ?
            `,
            [req.params.id],
            (err, result) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to pay fine",
                        error:
                            err.message
                    });
                }

                if (
                    result.affectedRows === 0
                ) {
                    return res.status(404).json({
                        success: false,
                        message:
                            "Fine not found"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Fine paid successfully"
                });
            }
        );
    }
);

// ==================================================
// NOTIFICATIONS
// ==================================================

app.get(
    "/api/notifications",
    (req, res) => {

        db.query(
            `
            SELECT *
            FROM notifications
            ORDER BY notification_time DESC
            `,
            (err, rows) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to fetch notifications",
                        error:
                            err.message
                    });
                }

                res.json({
                    success: true,
                    notifications: rows
                });
            }
        );
    }
);

// ==================================================
// USER NOTIFICATIONS
// ==================================================

app.get(
    "/api/notifications/user/:userId",
    (req, res) => {

        db.query(
            `
            SELECT *
            FROM notifications
            WHERE user_id = ?
            ORDER BY notification_time DESC
            `,
            [req.params.userId],
            (err, rows) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to fetch notifications",
                        error:
                            err.message
                    });
                }

                res.json({
                    success: true,
                    notifications: rows
                });
            }
        );
    }
);

// ==================================================
// ADD NOTIFICATION
// ==================================================

app.post(
    "/api/notifications",
    (req, res) => {

        const {
            id,
            user_id,
            userId,
            type,
            message,
            notification_time,
            time,
            is_read,
            read
        } = req.body;

        const finalUserId =
            user_id ?? userId;

        if (
            !finalUserId ||
            !type ||
            !message
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "userId, type and message are required"
            });
        }

        db.query(
            `
            INSERT INTO notifications
            (
                id,
                user_id,
                type,
                message,
                notification_time,
                is_read
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                id ||
                    `NOTIF-${Date.now()}`,
                finalUserId,
                type,
                message,
                notification_time ||
                    time ||
                    new Date(),
                is_read ??
                    read ??
                    0
            ],
            (err) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to create notification",
                        error:
                            err.message
                    });
                }

                res.status(201).json({
                    success: true,
                    message:
                        "Notification created successfully"
                });
            }
        );
    }
);

// ==================================================
// MARK NOTIFICATION READ
// ==================================================

app.put(
    "/api/notifications/:id/read",
    (req, res) => {

        db.query(
            `
            UPDATE notifications
            SET is_read = 1
            WHERE id = ?
            `,
            [req.params.id],
            (err) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to mark notification read",
                        error:
                            err.message
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Notification marked as read"
                });
            }
        );
    }
);

// ==================================================
// MARK ALL NOTIFICATIONS READ
// ==================================================

app.put(
    "/api/notifications/user/:userId/read-all",
    (req, res) => {

        db.query(
            `
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = ?
            `,
            [req.params.userId],
            (err) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to mark notifications read",
                        error:
                            err.message
                    });
                }

                res.json({
                    success: true,
                    message:
                        "All notifications marked as read"
                });
            }
        );
    }
);

// ==================================================
// START SERVER
// ==================================================

app.listen(
    PORT,
    () => {
        console.log(
            `Library backend running at http://localhost:${PORT}`
        );
    }
);