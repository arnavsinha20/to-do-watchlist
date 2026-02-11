# 🚀 To-Do Watchlist (Full Stack - MongoDB + Vercel)

A full-stack task manager application with email/password authentication.

- Frontend: Vanilla HTML, CSS, JavaScript  
- Backend: Node.js + Express (Serverless on Vercel)  
- Database: MongoDB Atlas (Cloud)  
- Deployment: Vercel  

---

## 🏗️ Architecture

Frontend (Static - Vercel)
        ↓
Express API (Serverless - Vercel)
        ↓
MongoDB Atlas (Cloud Database)

---

## 📁 Project Structure

to-do-watchlist/
├── backend/
│   ├── api/
│   │   └── index.js
│   └── src/
│       └── server.js
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── vercel.json
└── README.md

---

## 🛠️ Tech Stack

- Node.js
- Express
- MongoDB Atlas
- Mongoose
- bcryptjs
- Vercel

---

## ⚙️ Local Development

### 1️⃣ Install dependencies

cd backend  
npm install  

---

### 2️⃣ Create .env file inside backend/

MONGO_URI=your_mongodb_connection_string  
PORT=5000  

Example:

MONGO_URI=mongodb+srv://username:password@cluster0.mongodb.net/todoDB  
PORT=5000  

⚠️ Never commit .env to GitHub.

---

### 3️⃣ Run project

npm run dev  

Open in browser:

http://localhost:5000  

---

## 🔐 Authentication

- Users register with name, email, password  
- Passwords are hashed using bcryptjs  
- Passwords are never stored in plain text  

---

## 🗄️ Database (MongoDB Atlas)

Database: todoDB  

Collections:

- users  
- tasks  

Example user document:

{
  "_id": "...",
  "name": "Arnav",
  "email": "arnav@gmail.com",
  "password_hash": "$2a$10$..."
}

---

## 🔌 API Endpoints

All endpoints are prefixed with /api

POST   /api/auth/register  
POST   /api/auth/login  
GET    /api/users/:userId/tasks  
POST   /api/users/:userId/tasks  
PUT    /api/users/:userId/tasks/:taskId  
DELETE /api/users/:userId/tasks/:taskId  

All requests and responses use JSON.

---

## 🚀 Deployment (Vercel)

1️⃣ Push to GitHub  

git add .  
git commit -m "Deploy setup"  
git push  

2️⃣ Import to Vercel  

- Go to https://vercel.com  
- Add New Project  
- Import your repository  

3️⃣ Add Environment Variable in Vercel  

Project → Settings → Environment Variables  

Add:

MONGO_URI = your_mongodb_connection_string  

4️⃣ Deploy  

Vercel will:
- Deploy backend as serverless function  
- Serve frontend statically  
- Connect to MongoDB Atlas  

---

## 🔒 Security

- Passwords hashed using bcrypt  
- No hardcoded secrets  
- Database credentials stored in environment variables  
- .env ignored via .gitignore  

---

## 📌 Future Improvements

- Add JWT authentication  
- Add protected routes  
- Add task categories  
- Add pagination  
- Add user profile page  

---

## 📄 License

MIT License
