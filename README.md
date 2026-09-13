# POS Order & Inventory Management System

Live Demo (Frontend):https://pos-order-inventory-system1.vercel.app/

Backend API URL: [https://pos-backend-mc643n9oc-sashini.vercel.app](https://pos-backend-mc643n9oc-sashini.vercel.app)


A full-stack Point of Sale (POS) and Inventory Management System built with **Node.js (Express), MongoDB (Mongoose), and React (Vite)**. Built for the Techloom.ai technical assessment, this application features concurrency-safe stock handling, idempotent checkout logic, automatic order expiration (TTL), and an audit log.

---

## 🚀 Key Features

* **Real-time Inventory Management:** View stock levels, product details, and automatic stock status updates (In Stock / Out of Stock).
* **Concurrency-Safe Stock Reservation:** Uses atomic updates (`$inc` with `$gte` checks) to prevent race conditions during high-volume checkout scenarios.
* **Order TTL & Stock Auto-Release:** Unpaid or unconfirmed orders expire automatically after 5 minutes, releasing reserved stock back into inventory.
* **Idempotent Order Creation:** Prevents duplicate order processing using unique Idempotency Keys per checkout session.
* **Interactive UI & Audit Log:** Modern React interface for inventory tracking and timestamped order history logs.
* **API Testing:** Verified via **Postman** for all HTTP requests (GET, POST, PUT) including error payloads.

---

## 🛠 Tech Stack

* **Frontend:** React, Vite, CSS / Tailwind CSS, Axios
* **Backend:** Node.js, Express.js (Monolithic route configuration in `server.js`)
* **Database:** MongoDB, Mongoose ODM
* **Testing & Tools:** Postman, Git, GitHub

---

## 📁 Repository Structure

```text
POS-Order-Inventory-System/
├── pos-backend/          # Express API Server
│   ├── models/           # Mongoose Data Models (Product, Order, AuditLog)
│   ├── server.js         # Direct Express routes & server logic
│   └── package.json
├── pos-frontend/         # React + Vite Client
│   ├── src/              # React Components & Views
│   ├── package.json
│   └── vite.config.js
└── README.md
