# Naval Intelligence Platform

A real-time maritime surveillance and fleet monitoring system designed to demonstrate software development capabilities for defense industry applications.

## Overview

The Naval Intelligence Platform is a centralized web application that integrates multiple real-time data streams for maritime operational awareness. Built with modern web technologies, this system provides comprehensive vessel tracking, environmental intelligence, system monitoring, and fleet analytics.

**Project Status:** In Development (Target Completion: May 2026)

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- An [AISStream.io](https://aisstream.io) API key

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ryantpham/597-capstone.git
   cd 597-capstone
   ```

2. Create a `.env` file in the `server/` directory:
   ```bash
   # server/.env
   AISSTREAM_API_KEY=your_api_key_here
   ```

3. Install dependencies for both server and client:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

### Running Locally

Open two terminal windows:

**Terminal 1 — Start the server (port 3001):**
```bash
cd server
npm run dev      # uses nodemon for auto-reload
# or
npm start        # plain node
```

**Terminal 2 — Start the client (port 3000):**
```bash
cd client
npm start
```

The app will be available at `http://localhost:3000`. The client proxies API requests to the server at `http://localhost:3001`.

### External APIs
- **AISStream.io** - Real-time vessel AIS data
- **NOAA Marine Weather** - Wave height, wind speed, ocean conditions
- **Leaflet/OpenStreetMap** - Interactive mapping services

### Development Tools
- **Editor:** Visual Studio Code
- **Version Control:** Git/GitHub
- **Package Manager:** npm
- **API Testing:** Postman

## Project Goals

### Primary Objectives
- Develop a functional MVP maritime surveillance system
- Demonstrate proficiency with React and Node.js stack
- Showcase real-time data processing and multi-source API integration
- Create a portfolio piece aligned with defense industry requirements

### Secondary Objectives
- Gain practical experience with defense-focused software development
- Learn industry-standard UX/UI practices for command center interfaces
- Build capabilities relevant to Fleet Health Monitoring and System Engineering roles
- Support career transition into defense contractors (Boeing, Northrop Grumman)

## Academic Context

- **Course:** CPSC 597 Capstone Project
- **Institution:** California State University, Fullerton
- **Advisor:** Dr. Bin Cong
- **Student:** Ryan Pham
- **Semester:** Spring 2026

## Contact

**Ryan Pham**  
M.S. Software Engineering Student  
California State University, Fullerton  
Email: ryanpham0503@csu.fullerton.edu
