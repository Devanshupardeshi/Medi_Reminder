# 🏥 Medi_Reminder: Nexus 2.0

> **Empowering Healthcare with AI-Driven Prescription Intelligence.**

Medi_Reminder is a comprehensive medical ecosystem designed to simplify healthcare management. Nexus 2.0 introduces advanced AI capabilities to bridge the gap between complex medical documents and user-friendly health tracking.

---

## 🌟 Key Features

### 🔍 AI Prescription Scanner (Nexus 2.0)
Our flagship tool for Nexus 2.0, located in `/tools/gemini_tester`, leverages the power of **Google Gemini 1.5 & 2.0** to decypher even the most challenging medical handwriting.

- **Multimodal AI**: Scans images to identify medicines, dosages, and frequencies.
- **Live Model Discovery**: Dynamically fetches the latest Gemini models available to your API key.
- **Structured Data Extraction**: Converts raw prescription images into actionable medical data.

### 🛡️ Secure & Scalable Backend
Built with a modular architecture to support high-performance medical data processing.

---

## 🚀 Getting Started

### 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Devanshupardeshi/Medi_Reminder.git
   cd Medi_Reminder
   ```

2. **Run the AI Prescription Tool:**
   ```bash
   cd tools/gemini_tester
   pip install -r requirements.txt # See tools/gemini_tester/README.md
   python prescription_gui.py
   ```

---

## 🛠️ Project Structure

```
Medi_Reminder/
├── backend/            # Scalable API & Logic
├── tools/
│   └── gemini_tester/  # AI Prescription Scanner GUI
└── README.md           # You are here!
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ for a healthier future.
