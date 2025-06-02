# AI-Powered Code Editor

A modern, feature-rich code editor with AI integration, speech-to-text capabilities, and real-time code execution. Built with React and powered by Google's Gemini AI.

## 🌟 Features

- **AI-Powered Code Analysis**

  - Real-time code analysis using Google's Gemini AI
  - Intelligent code suggestions and improvements
  - Natural language interaction with AI

- **Interactive Code Execution**

  - Support for multiple programming languages:
    - Python
    - JavaScript
    - TypeScript
    - C++
    - Java
  - Real-time code execution
  - Test case input support
  - Immediate output display

- **Speech Integration**

  - Speech-to-text functionality
  - Text-to-speech for AI responses
  - Auto-send speech recognition
  - Manual speech input option

- **Interview Mode**

  - AI-powered coding interview preparation
  - Focus on DSA, SQL, and other programming topics
  - Interactive Q&A sessions
  - Real-time feedback

- **User Experience**
  - Dark/Light theme support
  - Responsive design
  - Modern UI with intuitive controls
  - Real-time conversation history

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Gemini API key
- Google Text-to-Speech API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/karansingh21202/CodeEdi1.git
   cd CodeEdi1
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your API keys:

   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_GOOGLE_TTS_API_KEY=your_tts_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 🔧 Usage

### Code Editor

- Select your programming language from the dropdown
- Write or paste your code in the editor
- Use the "Run" button to execute your code
- Add test cases in the input field below the editor

### AI Features

- Click "Analyze Code" to get AI feedback on your code
- Use the chat interface to ask questions about your code
- Enable "Interview Mode" for coding interview preparation

### Speech Features

- Click the microphone icon to start speech recognition
- Toggle "Auto Send Speech" to automatically process recognized speech
- Use the chat interface to interact with the AI using voice

## 🎨 Customization

### Themes

- Toggle between light and dark themes using the theme button
- The theme preference is automatically saved

### Language Support

- The editor supports multiple programming languages
- Each language has its own syntax highlighting and execution environment

## 🔒 Security

- API keys are stored securely in environment variables
- Code execution is sandboxed for security
- Input validation and sanitization are implemented

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_TTS_API_KEY`
4. Deploy your application

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Gemini AI for the AI capabilities
- Google Text-to-Speech API for voice features
- React and Vite for the frontend framework
- All other open-source libraries used in this project
