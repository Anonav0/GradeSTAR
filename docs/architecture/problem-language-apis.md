# GradeSTAR — Problem Discovery & Language APIs (Phase 3C)

## 1. Overview

Phase 3C establishes the public, read-only discovery interface for problems and supported programming languages on the GradeSTAR platform.

Candidates can explore published coding challenges, review problem statements and specifications, examine public sample test cases, filter by difficulty, search by keyword, paginate through problem listings, and retrieve available execution environments.

### Core Security Invariants

1. **Public vs. Hidden Test Case Isolation**: Hidden test cases, hidden evaluation inputs, expected outputs, hidden test case IDs, and execution metrics are **strictly filtered at the database level inside Prisma queries**. They never enter application memory for public requests and are never serialized into responses.
2. **Draft / Unpublished Problem Secrecy**: Problems where `isPublished = false` are filtered inside the database query. Requesting an unpublished problem slug returns the exact same generic `404 Not Found — Problem not found` response as a nonexistent slug. No timing difference or metadata reveals whether an unpublished problem exists.
3. **Internal Field Sanitization**: Internal database keys (`id`, `problemId`, `isPublished`, `createdAt`, `updatedAt`, `passwordHash`, moderation metadata) are explicitly omitted using Prisma `select` projections.
4. **Anonymous Read Access**: All endpoints are public and require no authentication headers, session cookies, or CSRF tokens.

---

## 2. API Endpoints Specification

Mount path: `/api/v1`

| Method | Endpoint                 | Auth Required | Description                                                        | Status Codes               |
| :----- | :----------------------- | :-----------: | :----------------------------------------------------------------- | :------------------------- |
| `GET`  | `/api/v1/problems`       |      No       | Lists published problems with pagination, filtering, and sorting   | `200`, `400`, `500`        |
| `GET`  | `/api/v1/problems/:slug` |      No       | Retrieves published problem statement and public sample test cases | `200`, `400`, `404`, `500` |
| `GET`  | `/api/v1/languages`      |      No       | Retrieves enabled programming languages supported for submissions  | `200`, `500`               |

---

## 3. Endpoint Details

### 3.1 List Published Problems (`GET /api/v1/problems`)

#### Supported Query Parameters

| Parameter    | Type             |   Default   | Constraints & Rules                                                                  |
| :----------- | :--------------- | :---------: | :----------------------------------------------------------------------------------- |
| `page`       | Positive Integer |     `1`     | Min: `1`. Coerced from string.                                                       |
| `limit`      | Positive Integer |    `10`     | Min: `1`, Max: `50`. Coerced from string.                                            |
| `difficulty` | Enum             |   _None_    | Must match `ProblemDifficulty`: `EASY`, `MEDIUM`, `HARD`.                            |
| `sortBy`     | Enum             | `createdAt` | Allowlist: `createdAt`, `title`, `difficulty`. Arbitrary fields rejected with `400`. |
| `sortOrder`  | Enum             |   `desc`    | Options: `asc`, `desc`.                                                              |
| `q`          | String           |   _None_    | Optional keyword search against title and slug (case-insensitive, 1–100 chars).      |

#### Sorting & Determinism

Sorting applies primary ordering according to `sortBy` and `sortOrder`, with a stable secondary sort on `slug asc` to ensure pagination consistency when multiple records share identical primary keys.

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "slug": "two-sum",
        "title": "Two Sum",
        "difficulty": "EASY",
        "createdAt": "2026-11-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### Validation Error (`400 Bad Request`)

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "path": "limit",
      "message": "Limit cannot exceed 50"
    }
  ],
  "timestamp": "2026-11-18T18:00:00.000Z",
  "requestId": "req-123"
}
```

---

### 3.2 Retrieve Problem by Slug (`GET /api/v1/problems/:slug`)

#### Path Parameters

- `slug` (string, required): Kebab-case URL-friendly identifier matching `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (1–100 chars).

#### Visibility Rules

- Database query: `where: { slug, isPublished: true }`.
- If no record matches (either because the slug does not exist or `isPublished = false`), the API returns:

```json
{
  "statusCode": 404,
  "error": "PROBLEM_NOT_FOUND",
  "message": "Problem not found",
  "timestamp": "2026-11-18T18:00:00.000Z",
  "requestId": "req-123"
}
```

#### Sample Test Cases

- Only test cases with `visibility = PUBLIC` are queried from PostgreSQL.
- Nested select restricts fields strictly to: `input`, `expectedOutput`, `position`.
- Test cases are ordered by `position asc`, `id asc`.
- Hidden test cases are completely excluded.

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "problem": {
      "slug": "two-sum",
      "title": "Two Sum",
      "statement": "Given an array of integers nums and an integer target...",
      "difficulty": "EASY",
      "inputDescription": "Line 1: Integer N...",
      "outputDescription": "Print the two 0-based indices...",
      "constraints": "2 <= nums.length <= 10^4",
      "timeLimitMs": 1000,
      "memoryLimitMb": 256,
      "sampleTestCases": [
        {
          "position": 1,
          "input": "4\n2 7 11 15\n9\n",
          "expectedOutput": "0 1\n"
        }
      ]
    }
  }
}
```

---

### 3.3 List Enabled Languages (`GET /api/v1/languages`)

Retrieves available programming languages that candidates may select for submissions.

#### Requirements

- Database query: `where: { isEnabled: true }`.
- Deterministic ordering: `orderBy: [{ name: 'asc' }, { slug: 'asc' }]`.
- Fields selected: `name`, `slug`, `version`.
- Disabled languages and execution configs are omitted.

#### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "name": "C++17",
        "slug": "cpp17",
        "version": "17"
      },
      {
        "name": "Java 21",
        "slug": "java21",
        "version": "21"
      },
      {
        "name": "Python 3",
        "slug": "python3",
        "version": "3.11"
      }
    ]
  }
}
```

---

## 4. Example `curl` Commands

```bash
# 1. List published problems (first page, default limit 10)
curl -s "http://localhost:3000/api/v1/problems"

# 2. Filter by EASY difficulty, sort by title ascending, page 1 with limit 5
curl -s "http://localhost:3000/api/v1/problems?difficulty=EASY&sortBy=title&sortOrder=asc&page=1&limit=5"

# 3. Search for problems matching keyword "two-sum"
curl -s "http://localhost:3000/api/v1/problems?q=two-sum"

# 4. Retrieve published problem details and sample test cases
curl -s "http://localhost:3000/api/v1/problems/two-sum"

# 5. List enabled programming languages
curl -s "http://localhost:3000/api/v1/languages"
```
