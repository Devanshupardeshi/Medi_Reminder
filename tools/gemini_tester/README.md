# 🩺 Gemini Prescription Scanner

A high-performance, modern GUI application built with Python and Google's Gemini AI to scan, analyze, and extract structured medical information from handwritten or printed prescriptions.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Gemini](https://img.shields.io/badge/AI-Gemini%201.5%2F2.0-orange)

## ✨ Features

- **Live Model Fetching**: Connects directly to Google's API to fetch every model available for your API Key.
- **Vision-Focused Filtering**: Automatically identifies and prioritizes multimodal models (Gemini 1.5 Flash, 1.5 Pro, etc.) that can "see" and read images.
- **Pharmacist-Grade Analysis**: Uses a specialized prompt to extract:
  - 💊 Medicine Names
  - 📏 Dosages (e.g., 500mg, 10ml)
  - ⏰ Frequencies (e.g., 1-0-1, twice daily)
  - ⏳ Duration & Special Instructions
- **Modern Dark UI**: Built with a sleek, user-friendly interface for better focus and readability.
- **Real-time Debugging**: Integrated logging to track API connectivity and extraction status.

## 🚀 Getting Started

### Prerequisites

- Python 3.10 or higher
- A Google Gemini API Key (Get it at [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Devanshupardeshi/gemini-prescription-scanner.git
   cd gemini-prescription-scanner
   ```

2. Install dependencies:
   ```bash
   pip install google-generativeai Pillow
   ```

3. Run the application:
   ```bash
   python prescription_gui.py
   ```

## 🛠️ How to Use

1. **Enter API Key**: Paste your Google API Key in the configuration field.
2. **Fetch Models**: Click the **🔄 Fetch Models** button to load the latest Gemini models available for your account.
3. **Select Model**: Choose a vision-capable model (we recommend `gemini-1.5-flash` for the best balance of speed and accuracy).
4. **Upload Image**: Select a clear photo or scan of a medical prescription.
5. **Scan**: Hit the **⚡ Scan with Gemini** button and watch as the AI deciphers the prescription into structured text.

## 🛡️ Important Disclaimer

This tool is for **demonstration and educational purposes only**. Always verify extracted information with a qualified medical professional or pharmacist before taking any medication. Never rely solely on AI for medical decisions.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Built with ❤️ by [Devanshupardeshi](https://github.com/Devanshupardeshi)
