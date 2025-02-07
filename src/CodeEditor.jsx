import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Play, Wand2, Code, FileText, Sun, Moon, Mic } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ElevenLabsClient } from "elevenlabs"; // Import ElevenLabs client
import systemPrompt from './systemPrompt';

const CodeEditor = () => {
  // Editor and AI states
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [testCaseInput, setTestCaseInput] = useState(''); // For running code with test input
  const [input, setInput] = useState(''); // For conversation input
  const [output, setOutput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [activeTab, setActiveTab] = useState('output');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const [sessionId, setSessionId] = useState('');
  // For Text-to-Speech (TTS)
  const [ttsLoading, setTtsLoading] = useState(false);
  // New TTS provider state: "google" or "elevenlabs"
  const [ttsProvider, setTtsProvider] = useState("google");

  // Conversation messages state
  const [messages, setMessages] = useState([]);


  
  // State for speech-to-text transcript
  const [transcript, setTranscript] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [autoStop, setAutoStop] = useState(true);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null); // To manage currently playing audio

  // New Interview mode state
  const [interviewMode, setInterviewMode] = useState(false);

  // Listening and speech system
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const speechResult = event.results[event.results.length - 1][0].transcript;
        setTranscript(speechResult);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (autoStop) {
          silenceTimerRef.current = setTimeout(() => {
            recognition.stop();
            setIsListening(false);
          }, 10000);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening && !autoStop) {
          recognition.start();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [autoStop, isListening]);

  // Scroll chat view to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Generate or retrieve a unique session ID from localStorage
  useEffect(() => {
    let storedSessionId = localStorage.getItem('sessionId');
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem('sessionId', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  // Gemini API configuration (Replace with your own API key)
  const GEMINI_API_KEY = "AIzaSyAeRbWgIu_IArn8_M-VvJn9ZMPaIWnrUeY"; 
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });

  const generationConfig = {
    temperature: 2,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  // Function to execute code using the external API
  const executeCode = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language,
          version: '*',
          files: [{
            name: `main.${language}`,
            content: code
          }],
          stdin: testCaseInput // Use test case input here
        })
      });

      if (!response.ok) {
        throw new Error(`Code execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      setOutput(result.run?.stdout || result.run?.stderr || 'No output');
    } catch (error) {
      setOutput(`Execution Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze conversation input using AI (for general conversation)
  const analyzeWithAI = async () => {
    setIsLoading(true);
    try {
      const userMessage = { role: 'user', text: input };
      setMessages(prev => [...prev, userMessage]);
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const chatSession = model.startChat({
        generationConfig,
        history: conversationHistory,
      });
  
      const result = await chatSession.sendMessage(input);
      console.log('API Response:', result);

      const botContent =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Sorry, I did not receive a proper response.';
      const botMessage = { role: 'model', text: botContent };
      setMessages(prev => [...prev, botMessage]);
      console.log("AI Analysis Text:", botContent);
  
      setAiResponse(botContent);
      setActiveTab('ai');
  
      await handleConvertToSpeech(botContent, true);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      const errorMessage = { role: 'model', text: `Oops! Something went wrong: ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    setInput('');
  };

  // Analyze code using AI by sending the code and test case input
  const analyzeCodeWithAI = async () => {
    setIsLoading(true);
    try {
      // Build a message that contains the code and test case input
      const userMessage = {
        role: 'user',
        text: `Please analyze my code:\n\n${code}\n\nTest Case Input:\n${testCaseInput || "None"}`
      };
      setMessages(prev => [...prev, userMessage]);
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const chatSession = model.startChat({
        generationConfig,
        history: conversationHistory,
      });
  
      // We send a request that asks the AI to analyze the code
      const result = await chatSession.sendMessage("Analyze the above code and test cases.");
      console.log('API Response:', result);

      const botContent =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Sorry, I did not receive a proper response.';
      const botMessage = { role: 'model', text: botContent };
      setMessages(prev => [...prev, botMessage]);
      console.log("AI Code Analysis Text:", botContent);
  
      setAiResponse(botContent);
      setActiveTab('ai');
  
      await handleConvertToSpeech(botContent, true);
    } catch (error) {
      console.error("AI Code Analysis Error:", error);
      const errorMessage = { role: 'model', text: `Oops! Something went wrong: ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    setTestCaseInput('');
  };

  // Convert text to speech using TTS provider (Google or ElevenLabs)
  const handleConvertToSpeech = async (textToSpeak, shouldStream = false) => {
    textToSpeak = String(textToSpeak);
    // Clean up the text (remove any asterisks)
    textToSpeak = textToSpeak.replace(/[*`]+/g, '').replace(/_/g, ' ').replace(/#+/g, '').replace(/[{}[\]()<>|]/g, '').replace(/[\\/]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[:;]/g, ',').replace(/["'`]+/g, '').replace(/[+=%^&$]/g, '').replace(/<\/?[^>]+(>|$)/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    
    if (!textToSpeak.trim()) {
      alert("No text available to convert to speech.");
      return;
    }
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTtsLoading(true);

    if (ttsProvider === "google") {
      // Use Google's TTS
      const requestBody = {
        audioConfig: {
          audioEncoding: "MP3",
          effectsProfileId: ["small-bluetooth-speaker-class-device"],
          pitch: 0,
          speakingRate: 1.0,
        },
        input: { text: textToSpeak },
        voice: { languageCode: "en-US", name: "en-US-Journey-F" },
      };

      try {
        const response = await axios.post(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=AIzaSyAeS0eXbmRipDiiV9mOoO8djLwZitvcYNY`,
          requestBody,
          { headers: { "Content-Type": "application/json" } }
        );

        if (response.data.audioContent) {
          const audioContent = response.data.audioContent;
          const audioBlob = new Blob(
            [Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0))],
            { type: "audio/mp3" }
          );
          const url = URL.createObjectURL(audioBlob);
          if (shouldStream) {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play();
          } else {
            const a = document.createElement("a");
            a.href = url;
            a.download = "synthesized-audio.mp3";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } else {
          console.error("API did not return audio content:", response);
          alert("No audio content returned from the API. Please try again.");
        }
      } catch (error) {
        console.error("Error generating speech with Google:", error.response || error.message);
        alert("There was an error generating the speech with Google. Please check your API key and configurations.");
      } finally {
        setTtsLoading(false);
      }
    } else if (ttsProvider === "elevenlabs") {
      // Use ElevenLabs TTS
      const client = new ElevenLabsClient({ apiKey: "sk_2034ca3d9ee3758a11d9446ce21000789d4be5380831119c" });
      try {
        const result = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
          output_format: "mp3_44100_128",
          text: textToSpeak,
          model_id: "eleven_multilingual_v2"
        });
        // Assume result.audioContent is returned similarly (adapt if needed)
        if (result.audioContent) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(result.audioContent), (c) => c.charCodeAt(0))],
            { type: "audio/mp3" }
          );
          const url = URL.createObjectURL(audioBlob);
          if (shouldStream) {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.play();
          } else {
            const a = document.createElement("a");
            a.href = url;
            a.download = "synthesized-audio.mp3";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        }
      } catch (error) {
        console.error("Error generating speech with ElevenLabs:", error);
        alert("There was an error generating the speech with ElevenLabs.");
      } finally {
        setTtsLoading(false);
      }
    }
  };

  const isExecutableLanguage = ['python', 'javascript', 'typescript', 'cpp', 'java'];

  // Function to start the interview mode
  const startInterview = async () => {
    setInterviewMode(true);
    const initialPrompt = "Are you ready for your coding preparation round? Please let me know which area you'd like to focus on—DSA, SQL, or something else?";
    
    // Add a system-like instruction in the conversation (will be used in later responses)
    const instructionMessage = {
      role: 'user',
      text: systemPrompt
    };

    // Update conversation with the instruction and the initial prompt.
    setMessages(prev => [...prev, instructionMessage, { role: 'model', text: initialPrompt }]);
    
    // Use TTS to speak the prompt.
    await handleConvertToSpeech(initialPrompt, true);
  };

  // Interview conversation handler
  const interviewWithAI = async () => {
    setIsLoading(true);
    try {
      // Instead of prepending a system message (which causes the error), we now prepend a dummy user message with interview instructions.
      const interviewInstruction = systemPrompt;
      
      const conversationHistory = [
        // Ensure the first message is from the user.
        {
          role: 'user',
          parts: [{ text: interviewInstruction }]
        },
        ...messages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [{ text: input }]
        }
      ];
      
      // Start a new chat session with the interview prompt.
      const chatSession = model.startChat({
        generationConfig,
        history: conversationHistory,
      });
      
      // The AI will now act as an interviewer.
      const result = await chatSession.sendMessage(input);
      const botContent = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
        'Sorry, I did not receive a proper response.';
      
      const botMessage = { role: 'model', text: botContent };
      setMessages(prev => [...prev, botMessage]);
      setAiResponse(botContent);
      setActiveTab('ai');
      
      // Speak the interviewer’s response.
      await handleConvertToSpeech(botContent, true);
    } catch (error) {
      console.error("Interview Error:", error);
      const errorMessage = { role: 'model', text: `Oops! Something went wrong: ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    setInput('');
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'} w-full`}>
      <div className="w-full max-w-4xl mx-auto p-4 rounded-xl shadow-lg">
        {/* Display Session ID for debugging */}
        <div className="mb-2 text-sm">
          <span><strong>Session ID:</strong> {sessionId}</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`p-2 border rounded text-sm font-medium transition-all duration-200 ${
                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-50 text-black hover:bg-gray-100'
              }`}
            >
              {['python', 'javascript', 'typescript', 'cpp', 'java', 'text'].map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
            {/* TTS Provider Dropdown */}
            <select
              value={ttsProvider}
              onChange={(e) => setTtsProvider(e.target.value)}
              className={`p-2 border rounded text-sm font-medium transition-all duration-200 ${
                theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-50 text-black hover:bg-gray-100'
              }`}
            >
              <option value="google">Google TTS</option>
              <option value="elevenlabs">ElevenLabs TTS</option>
            </select>

            <div className="flex space-x-2">
              <button
                onClick={isExecutableLanguage.includes(language) ? executeCode : null}
                disabled={!isExecutableLanguage.includes(language) || isLoading}
                className={`transition-all duration-200 ${
                  isExecutableLanguage.includes(language)
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-gray-400 cursor-not-allowed'
                } text-white px-4 py-2 rounded-md flex items-center shadow-md hover:shadow-lg`}
              >
                <Play className="mr-2" size={20} /> Run
              </button>
              {/* New Analyze Code button */}
              <button
                onClick={() => analyzeCodeWithAI()}
                disabled={isLoading || ttsLoading || !code.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md flex items-center shadow-md hover:shadow-lg"
              >
                <Wand2 className="mr-2" size={20} /> Analyze Code
              </button>
              {/* Existing AI Analyze button for conversation */}
              <button
                onClick={() => {
                  if (interviewMode) {
                    interviewWithAI();
                  } else {
                    analyzeWithAI();
                  }
                }}
                disabled={isLoading || ttsLoading || !input.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md flex items-center shadow-md hover:shadow-lg"
              >
                <Wand2 className="mr-2" size={20} /> Send Message
              </button>
              {/* New Interview button */}
              <button
                onClick={startInterview}
                disabled={isLoading || ttsLoading}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-md flex items-center shadow-md hover:shadow-lg"
              >
                <Wand2 className="mr-2" size={20} /> Start Interview
              </button>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 border rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center space-x-2 shadow-md hover:shadow-lg"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Left Column: Code Editor and Test Case Input */}
          <div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write your code here..."
              className={`w-full h-64 p-3 border rounded font-mono text-sm resize-none focus:outline-none transition-all duration-200 shadow-md ${
                theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'
              }`}
            />
            <input
              type="text"
              value={testCaseInput}
              onChange={(e) => setTestCaseInput(e.target.value)}
              placeholder="Enter test case input (optional)..."
              className={`w-full p-2 border rounded mt-2 text-sm resize-none focus:outline-none transition-all duration-200 shadow-md ${
                theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'
              }`}
            />
          </div>

          {/* Right Column: Speech Input, Conversation, and AI Analysis */}
          <div>
            {/* Speech-to-Text Input Section */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <button
                  onClick={handleMicClick}
                  className="p-2 bg-blue-500 text-white rounded-full shadow-md hover:bg-blue-600 transition"
                >
                  <Mic size={20} />
                </button>
                <button
                  onClick={() => {
                    setInput(transcript);
                    setTranscript('');
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded shadow-md hover:bg-green-600 transition"
                >
                  Use Speech Input
                </button>
              </div>
              <div className="border p-2 rounded mb-4">
                <p className="font-semibold mb-1">Speech-to-Text:</p>
                <p>{transcript || "Your speech will appear here..."}</p>
              </div>
            </div>

            {/* Conversation Chat Box */}
            <div className="border p-2 rounded mb-4 h-40 overflow-y-auto">
              <p className="font-semibold mb-1">Conversation:</p>
              {messages.map((msg, idx) => (
                <div key={idx} className={`mb-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-2 py-1 rounded ${msg.role === 'user' ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-900'}`}>
                    {msg.text}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Conversation Input */}
            <div className="flex items-center mb-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your message here..."
                className={`w-full h-20 p-3 border rounded text-sm resize-none focus:outline-none transition-all duration-200 shadow-md ${
                  theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'
                }`}
              />
              <button
                onClick={() => {
                  if (interviewMode) {
                    interviewWithAI();
                  } else {
                    analyzeWithAI();
                  }
                }}
                disabled={isLoading || ttsLoading || !input.trim()}
                className="ml-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded shadow-md transition"
              >
                Send Message
              </button>
            </div>

            {/* AI Analysis / Output Area */}
            <div className="flex mb-2">
              <button
                onClick={() => setActiveTab('output')}
                className={`mr-2 px-4 py-2 rounded-md transition-all duration-200 shadow-md flex items-center space-x-2 ${
                  activeTab === 'output'
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                <Code size={20} /> <span>Output</span>
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-md transition-all duration-200 shadow-md flex items-center space-x-2 ${
                  activeTab === 'ai'
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                <FileText size={20} /> <span>AI Analysis</span>
              </button>
            </div>

            <textarea
              value={activeTab === 'output' ? output : aiResponse}
              readOnly
              placeholder={activeTab === 'output' ? 'Output will appear here...' : 'AI analysis will appear here...'}
              className={`w-full h-32 p-3 border rounded text-sm resize-none focus:outline-none transition-all duration-200 shadow-md ${
                theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
