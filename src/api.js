const API_URL = "http://localhost:5000";

async function parseResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || fallback);
  }

  return data;
}

/* =========================
   ACCOUNTS
========================= */

export async function registerAccount(accountData) {
  const response = await fetch(`${API_URL}/api/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(accountData),
  });

  const data = await parseResponse(response, "Registration failed");
  return data.account;
}

export async function loginAccount(loginData) {
  const response = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(loginData),
  });

  const data = await parseResponse(response, "Login failed");
  return data.account;
}

export async function getAccounts() {
  const response = await fetch(`${API_URL}/api/accounts`);

  const data = await parseResponse(
    response,
    "Failed to load accounts"
  );

  return data.accounts;
}

/* =========================
   BOOKS
========================= */

export async function getBooks() {
  const response = await fetch(`${API_URL}/api/books`);

  const data = await parseResponse(
    response,
    "Failed to load books"
  );

  return data.books;
}

export async function addBook(bookData) {
  const response = await fetch(`${API_URL}/api/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bookData),
  });

  const data = await parseResponse(
    response,
    "Failed to add book"
  );

  return data.book;
}

export async function updateBook(bookId, bookData) {
  const response = await fetch(
    `${API_URL}/api/books/${bookId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bookData),
    }
  );

  const data = await parseResponse(
    response,
    "Failed to update book"
  );

  return data.book;
}

export async function deleteBook(bookId) {
  const response = await fetch(
    `${API_URL}/api/books/${bookId}`,
    {
      method: "DELETE",
    }
  );

  return parseResponse(
    response,
    "Failed to delete book"
  );
}

/* =========================
   ISSUES
========================= */

export async function getIssues() {
  const response = await fetch(`${API_URL}/api/issues`);

  const data = await parseResponse(
    response,
    "Failed to load issues"
  );

  return data.issues;
}

export async function issueBook(issueData) {
  const response = await fetch(`${API_URL}/api/issues`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issueData),
  });

  const data = await parseResponse(
    response,
    "Failed to issue book"
  );

  return data.issue;
}

export async function returnBook(issueId, byAccount) {
  const response = await fetch(
    `${API_URL}/api/issues/${issueId}/return`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        byAccount,
      }),
    }
  );

  const data = await parseResponse(
    response,
    "Failed to return book"
  );

  return data.issue;
}

export async function renewBook(
  issueId,
  dueDate,
  studentId
) {
  const response = await fetch(
    `${API_URL}/api/issues/${issueId}/renew`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dueDate,
        studentId,
      }),
    }
  );

  const data = await parseResponse(
    response,
    "Failed to renew book"
  );

  return data.issue;
}

/* =========================
   RESERVATIONS
========================= */

export async function getReservations() {
  const response = await fetch(
    `${API_URL}/api/reservations`
  );

  const data = await parseResponse(
    response,
    "Failed to load reservations"
  );

  return data.reservations;
}

export async function addReservation(reservationData) {
  /*
    IMPORTANT:
    Backend expects camelCase fields:
    bookId
    studentId
    reservedOn
    queuePosition
    status
  */

  const payload = {
    id: reservationData.id,

    bookId:
      reservationData.bookId ??
      reservationData.book_id,

    studentId:
      reservationData.studentId ??
      reservationData.student_id,

    reservedOn:
      reservationData.reservedOn ??
      reservationData.reserved_on ??
      new Date().toISOString(),

    queuePosition:
      reservationData.queuePosition ??
      reservationData.queue_position ??
      1,

    status:
      reservationData.status ??
      "Waiting",
  };

  if (!payload.bookId) {
    throw new Error("Book ID is required");
  }

  if (!payload.studentId) {
    throw new Error("Student ID is required");
  }

  const response = await fetch(
    `${API_URL}/api/reservations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await parseResponse(
    response,
    "Failed to create reservation"
  );

  return data.reservation;
}

export async function cancelReservation(
  reservationId
) {
  const response = await fetch(
    `${API_URL}/api/reservations/${reservationId}/cancel`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await parseResponse(
    response,
    "Failed to cancel reservation"
  );

  return data.reservation;
}

/* =========================
   FINES
========================= */

export async function getFines() {
  const response = await fetch(
    `${API_URL}/api/fines`
  );

  const data = await parseResponse(
    response,
    "Failed to load fines"
  );

  return data.fines;
}

export async function getStudentFines(studentId) {
  const response = await fetch(
    `${API_URL}/api/fines/student/${studentId}`
  );

  const data = await parseResponse(
    response,
    "Failed to load student fines"
  );

  return data.fines;
}

export async function payFine(fineId) {
  const response = await fetch(
    `${API_URL}/api/fines/${fineId}/pay`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await parseResponse(
    response,
    "Failed to mark fine as paid"
  );

  return data.fine;
}

/* =========================
   NOTIFICATIONS
========================= */

export async function getNotifications() {
  const response = await fetch(
    `${API_URL}/api/notifications`
  );

  const data = await parseResponse(
    response,
    "Failed to load notifications"
  );

  return data.notifications;
}

export async function getUserNotifications(userId) {
  const response = await fetch(
    `${API_URL}/api/notifications/user/${userId}`
  );

  const data = await parseResponse(
    response,
    "Failed to load user notifications"
  );

  return data.notifications;
}

export async function createNotification(
  notificationData
) {
  const response = await fetch(
    `${API_URL}/api/notifications`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id:
          notificationData.user_id ??
          notificationData.userId,

        type:
          notificationData.type ??
          "General",

        message:
          notificationData.message,
      }),
    }
  );

  const data = await parseResponse(
    response,
    "Failed to create notification"
  );

  return data.notification;
}

export async function markNotificationRead(
  notificationId
) {
  const response = await fetch(
    `${API_URL}/api/notifications/${notificationId}/read`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return parseResponse(
    response,
    "Failed to mark notification as read"
  );
}

export async function markAllNotificationsRead(
  userId
) {
  const response = await fetch(
    `${API_URL}/api/notifications/user/${userId}/read-all`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return parseResponse(
    response,
    "Failed to mark notifications as read"
  );
}

/* =========================
   DATABASE TEST
========================= */

export async function testDatabase() {
  const response = await fetch(
    `${API_URL}/api/test-db`
  );

  return parseResponse(
    response,
    "Database connection failed"
  );
}