# Voltaire

**Voltaire** is an open‑source **front‑end interface** for locally hosted AI chat models using **Ollama**.  
It allows you to run ChatGPT-like conversations fully on your machine — with image input, reasoning display, formatted code responses, and an accessible, modern UI.

---

## Overview

With OllaWeb, you can:
- Chat with a locally hosted AI model (via **Ollama**)
- Send and analyze images directly in chat
- See the model’s **reasoning process** as it thinks
- View **clean, formatted code blocks** with bold and italic styling
- Enjoy a smooth, accessible user interface for clear AI interaction

OllaWeb focuses on **transparency, usability, and control**, giving users a private and intelligent chat experience — all running locally.

---

## Features

- 🖥️ **Local Hosting** – no remote API required  
- 🧠 **Reasoning Display** – watch the model “think” before it replies  
- 🖼️ **Image Input** – send pictures for analysis  
- 💻 **Smart Code Formatting** – code blocks, bold, and italics handled cleanly  
- ♿ **Accessible UI** – readable, responsive, and keyboard-friendly design  
- 🔓 **Fully Open Source** – modify and expand freely  

---

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/Lundii1/OllaWeb.git
cd Voltaire
```

### 2. Set Up Ollama Locally
Follow the installation steps on the official [Ollama site](https://ollama.ai).  
Start your model (e.g. `ollama run llama2` or similar).

### 3. Run OllaWeb Front-End
```bash
npm install
npm run start
```
Then open the app in your browser — typically at `http://localhost:3000`.

---

## Requirements

- **Ollama** installed and running locally  
- **Node.js** and **npm** (for the front-end)  
- A **modern web browser**  

---

## Purpose

OllaWeb was built to demonstrate how a **local, private AI chat system** can rival cloud-based tools while remaining open and transparent.  
It’s designed as a front-end that makes interacting with locally hosted LLMs **intuitive, powerful, and visually clear**.
