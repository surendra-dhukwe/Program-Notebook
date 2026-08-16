# Program Notebook

A personal programming notebook built with:

- HTML
- CSS
- Vanilla JavaScript
- Node.js + Express
- MongoDB + Mongoose
- Prism.js for professional code highlighting

## Features

1. First screen asks for the user's name.
2. The name is stored as the notebook profile.
3. Home shows all notes in random order.
4. Notes page has Subject → Question → Answer navigation.
5. Add page can create a new subject or add under an existing subject.
6. Code is displayed in a separate syntax-highlighted block.
7. Four navigation buttons: Home, Notes, Add, Profile.
8. Search notes.
9. Responsive mobile design.
10. MongoDB stores users and notes.

## Folder

program-notebook/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
├── package.json
├── server.js
└── README.md

## Run

### 1. Install Node.js

Install Node.js LTS.

### 2. Install MongoDB

Use local MongoDB or MongoDB Atlas.

For local MongoDB, default URI:

mongodb://127.0.0.1:27017/program_notebook

### 3. Install packages

npm install

### 4. Create .env

Copy `.env.example` to `.env`.

### 5. Start

npm run dev

or:

npm start

Open:

http://localhost:5000

## MongoDB collections

The application automatically creates:

### users

- name
- createdAt

### notes

- subject
- question
- answer
- code
- userName
- createdAt

No manual SQL table creation is needed.
"# Program-Notebook" 
