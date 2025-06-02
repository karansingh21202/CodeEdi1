import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Play, Wand2, Code, Sun, Moon, Mic } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import systemPrompt from './systemPrompt';

const CodeEditor = () => {
  // Add API key validation
  useEffect(() => {
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const ttsKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY;
    
    if (!geminiKey) {
      console.error('Missing Gemini API key. Please check your environment variables.');
    }
    if (!ttsKey) {
      console.error('Missing Google TTS API key. Please check your environment variables.');
    }
  }, []);

  // Editor and AI states
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [testCaseInput, setTestCaseInput] = useState(''); // For running code with test input
  const [input, setInput] = useState(''); // For conversation input
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const [sessionId, setSessionId] = useState('');
  // For Text-to-Speech (TTS)
  const [ttsLoading, setTtsLoading] = useState(false);
  
  // Conversation messages state
  const [messages, setMessages] = useState([]);
  
  // Speech-to-text transcript and auto-send option
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [autoStop, setAutoStop] = useState(true);
  const [autoSend, setAutoSend] = useState(true); // Auto-send recognized speech
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null); // To manage currently playing audio
  
  // New Interview mode state
  const [interviewMode, setInterviewMode] = useState(false);
  
  // Add rate limiting state
  const [lastExecutionTime, setLastExecutionTime] = useState(0);
  const EXECUTION_COOLDOWN = 2000; // 2 seconds cooldown between executions
  
  // Set up Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
  
      recognition.onresult = (event) => {
        const speechResult = event.results[event.results.length - 1][0].transcript;
        if (autoSend) {
          // Automatically send the recognized speech for AI analysis.
          analyzeWithAI(speechResult);
          setTranscript('');
        } else {
          setTranscript(speechResult);
        }
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
  }, [autoStop, isListening, autoSend]);
  
  // Auto-scroll conversation view to the latest message
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
  
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Add function to list available models
  const listAvailableModels = async () => {
    try {
      const models = await genAI.listModels();
      console.log('Available models:', models);
    } catch (error) {
      console.error('Error listing models:', error);
    }
  };

  // Call listAvailableModels when component mounts
  useEffect(() => {
    listAvailableModels();
  }, []);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
  });
  
  const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
  };
  
  // Add input validation
  const validateCode = (code, language) => {
    if (!code.trim()) {
      return { isValid: false, error: 'Please enter some code to execute' };
    }

    // Basic security checks
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /process\./i,
      /require\s*\(/i,
      /import\s*\(/i,
      /fs\./i,
      /child_process/i,
      /exec\s*\(/i,
      /spawn\s*\(/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return { isValid: false, error: 'Code contains potentially dangerous patterns' };
      }
    }

    return { isValid: true };
  };
  
  // Update executeCode function with validation and rate limiting
  const executeCode = async () => {
    const now = Date.now();
    if (now - lastExecutionTime < EXECUTION_COOLDOWN) {
      setOutput(`Please wait ${Math.ceil((EXECUTION_COOLDOWN - (now - lastExecutionTime)) / 1000)} seconds before executing again`);
      return;
    }

    const validation = validateCode(code, language);
    if (!validation.isValid) {
      setOutput(`Error: ${validation.error}`);
      return;
    }

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
          stdin: testCaseInput
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Code execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.run?.stderr) {
        setOutput(`Error: ${result.run.stderr}`);
      } else {
        setOutput(result.run?.stdout || 'No output');
      }
      setLastExecutionTime(now);
    } catch (error) {
      setOutput(`Execution Error: ${error.message}`);
      console.error('Code execution error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update analyzeWithAI function with better error handling
  const analyzeWithAI = async (message) => {
    setIsLoading(true);
    try {
      const textToSend = message ? message : input;
      const userMessage = { role: 'user', text: textToSend };
      setMessages(prev => [...prev, userMessage]);

      // Create a new chat session for each message
      const chat = model.startChat({
        history: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        })),
        generationConfig,
      });

      const result = await chat.sendMessage(textToSend);
      
      if (!result || !result.response) {
        throw new Error('No response from AI model');
      }

      const botContent = result.response.text() || 'Sorry, I did not receive a proper response.';
      const botMessage = { role: 'model', text: botContent };
      setMessages(prev => [...prev, botMessage]);

      // Use Google TTS to speak the response
      await handleConvertToSpeech(botContent, true);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      const errorMessage = { 
        role: 'model', 
        text: `Oops! Something went wrong: ${error.message}. Please try again or check your API key.` 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    setInput('');
  };
  
  // Update analyzeCodeWithAI function with the same changes
  const analyzeCodeWithAI = async () => {
    setIsLoading(true);
    try {
      const userMessage = {
        role: 'user',
        text: `Please analyze my code:\n\n${code}\n\nTest Case Input:\n${testCaseInput || "None"}`
      };
      setMessages(prev => [...prev, userMessage]);

      const chat = model.startChat({
        history: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        })),
        generationConfig,
      });

      const result = await chat.sendMessage("Analyze the above code and test cases.");
      
      if (!result || !result.response) {
        throw new Error('No response from AI model');
      }

      const botContent = result.response.text() || 'Sorry, I did not receive a proper response.';
      const botMessage = { role: 'model', text: botContent };
      setMessages(prev => [...prev, botMessage]);

      await handleConvertToSpeech(botContent, true);
    } catch (error) {
      console.error("AI Code Analysis Error:", error);
      const errorMessage = { 
        role: 'model', 
        text: `Oops! Something went wrong: ${error.message}. Please try again or check your API key.` 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    setTestCaseInput('');
  };
  
  // Add this new function for text chunking
  const splitTextIntoChunks = (text, maxChunkLength = 200) => {
    // Split by sentences first
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    sentences.forEach(sentence => {
      if ((currentChunk + sentence).length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    });

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  };

  // Update handleConvertToSpeech to handle chunks
  const handleConvertToSpeech = async (textToSpeak, shouldStream = false) => {
    const ttsKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY;
    if (!ttsKey) {
      console.error('Google TTS API key is missing');
      return;
    }

    textToSpeak = String(textToSpeak);
    // Clean up the text
    textToSpeak = textToSpeak
      .replace(/[*`]+/g, '')
      .replace(/_/g, ' ')
      .replace(/#+/g, '')
      .replace(/[{}[\]()<>|]/g, '')
      .replace(/[\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[:;]/g, ',')
      .replace(/["'`]+/g, '')
      .replace(/[+=%^&$]/g, '')
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    
    if (!textToSpeak.trim()) {
      console.warn("No text available to convert to speech.");
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTtsLoading(true);

    const MAX_RETRIES = 3;
    const TIMEOUT = 30000;
    const CHUNK_DELAY = 500; // Delay between chunks in milliseconds

    // Split text into manageable chunks
    const textChunks = splitTextIntoChunks(textToSpeak);
    console.log(`Split text into ${textChunks.length} chunks`);

    const makeTTSRequest = async (chunk) => {
      let retryCount = 0;

      const attemptRequest = async () => {
        try {
          const requestBody = {
            audioConfig: {
              audioEncoding: "MP3",
              effectsProfileId: ["large-home-entertainment-class-device"],
              pitch: 0,
              speakingRate: 0.9,
            },
            input: { text: chunk },
            voice: { 
              languageCode: "en-US", 
              name: "en-US-Neural2-F",
              ssmlGender: "FEMALE"
            },
          };

          const response = await axios.post(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`,
            requestBody,
            { 
              headers: { "Content-Type": "application/json" },
              timeout: TIMEOUT
            }
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
              await new Promise((resolve, reject) => {
                audio.onended = resolve;
                audio.onerror = reject;
                audio.play().catch(reject);
              });
              URL.revokeObjectURL(url);
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
            return true;
          } else {
            throw new Error("No audio content returned from the API");
          }
        } catch (error) {
          console.error(`TTS attempt ${retryCount + 1} failed for chunk:`, error);
          if (retryCount < MAX_RETRIES - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            return attemptRequest();
          }
          throw error;
        }
      };

      return attemptRequest();
    };

    try {
      // Process chunks sequentially
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`Processing chunk ${i + 1}/${textChunks.length}`);
        
        try {
          await makeTTSRequest(chunk);
          // Add a small delay between chunks
          if (i < textChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
          }
        } catch (error) {
          console.error(`Failed to process chunk ${i + 1}:`, error);
          // Continue with next chunk even if current one fails
          continue;
        }
      }
    } catch (error) {
      console.error("TTS processing failed:", error);
      const errorMessage = { 
        role: 'model', 
        text: "Sorry, I'm having trouble generating speech for some parts of the response. Please try again." 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setTtsLoading(false);
    }
  };
  
  const isExecutableLanguage = ['python', 'javascript', 'typescript', 'cpp', 'java'];
  
  // Function to start the interview mode
  const startInterview = async () => {
    setInterviewMode(true);
    const initialPrompt = "Are you ready for your coding preparation round? Please let me know which area you'd like to focus on—DSA, SQL, or something else?";
    
    // Add a system-like instruction (for later responses)
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
      const interviewInstruction = systemPrompt;
      
      const conversationHistory = [
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
      
      const chatSession = model.startChat({
        generationConfig,
        history: conversationHistory,
      });
      
      const result = await chatSession.sendMessage(input);
      const botContent = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
        'Sorry, I did not receive a proper response.';
      
      const botMessage = { role: 'model', text: botContent };
      setMessages(prev => [...prev, botMessage]);
      
      // Speak the interviewer's response.
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
  
  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'} w-full`}>
      <div className="w-full max-w-5xl mx-auto p-6 rounded-xl shadow-2xl">
        {/* Display Session ID for debugging */}
        <div className="mb-3 text-base">
          <span><strong>Session ID:</strong> {sessionId}</span>
        </div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={`p-3 border rounded text-base font-medium transition-all duration-200 ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-50 text-black hover:bg-gray-100'}`}
            >
              {['python', 'javascript', 'typescript', 'cpp', 'java', 'text'].map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
  
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={isExecutableLanguage.includes(language) ? executeCode : null}
                disabled={!isExecutableLanguage.includes(language) || isLoading}
                className={`transition-all duration-200 ${isExecutableLanguage.includes(language)
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'} text-white px-6 py-3 rounded-md flex items-center shadow-lg`}
              >
                <Play className="mr-2" size={24} /> Run
              </button>
              {/* Analyze Code button */}
              <button
                onClick={analyzeCodeWithAI}
                disabled={isLoading || ttsLoading || !code.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-md flex items-center shadow-lg"
              >
                <Wand2 className="mr-2" size={24} /> Analyze Code
              </button>
              {/* Send Message button for conversation (optional) */}
              <button
                onClick={() => {
                  if (interviewMode) {
                    interviewWithAI();
                  } else {
                    analyzeWithAI();
                  }
                }}
                disabled={isLoading || ttsLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md flex items-center shadow-lg"
              >
                <Wand2 className="mr-2" size={24} /> Send Message
              </button>
              {/* Start Interview button */}
              <button
                onClick={startInterview}
                disabled={isLoading || ttsLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-md flex items-center shadow-lg"
              >
                <Wand2 className="mr-2" size={24} /> Start Interview
              </button>
            </div>
          </div>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-3 border rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-lg"
          >
            {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
            <span className="text-base">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Code Editor, Test Case Input, and Output Box */}
          <div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write your code here..."
              className={`w-full h-80 p-4 border rounded font-mono text-base resize-none focus:outline-none transition-all duration-200 shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
              aria-label="Code editor"
              role="textbox"
              aria-multiline="true"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <input
              type="text"
              value={testCaseInput}
              onChange={(e) => setTestCaseInput(e.target.value)}
              placeholder="Enter test case input (optional)..."
              className={`w-full p-3 border rounded mt-3 text-base resize-none focus:outline-none transition-all duration-200 shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
              aria-label="Test case input"
              role="textbox"
            />
            {/* Output Box with improved accessibility */}
            <div className="mt-6" role="region" aria-label="Code execution output">
              <p className="font-semibold text-lg mb-2">Output:</p>
              <textarea
                value={output}
                readOnly
                placeholder="Output will appear here..."
                className={`w-full h-32 p-4 border rounded text-base resize-none focus:outline-none transition-all duration-200 shadow-lg overflow-y-auto ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'}`}
                aria-label="Execution output"
                role="textbox"
                aria-readonly="true"
              />
            </div>
          </div>
  
          {/* Right Column: Speech Input and Conversation */}
          <div>
            {/* Speech-to-Text Input Section */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-3">
                <button
                  onClick={handleMicClick}
                  className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition"
                >
                  <Mic size={24} />
                </button>
                {/* If auto-send is disabled, allow the user to confirm the speech input */}
                {!autoSend && (
                  <button
                    onClick={() => {
                      setInput(transcript);
                      analyzeWithAI();
                      setTranscript('');
                    }}
                    className="px-6 py-3 bg-green-600 text-white rounded-md shadow-lg hover:bg-green-700 transition text-base"
                  >
                    Use Speech Input
                  </button>
                )}
              </div>
              <div className="border p-4 rounded mb-3">
                <p className="font-semibold text-lg mb-2">Speech-to-Text:</p>
                <p className="text-base">{transcript || "Your speech will appear here..."}</p>
              </div>
              {/* Auto-Send Speech Checkbox */}
              <label className="inline-flex items-center gap-2 mt-2 text-lg">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={() => setAutoSend(!autoSend)}
                  className="h-6 w-6"
                />
                <span>Auto Send Speech</span>
              </label>
            </div>
  
            {/* Conversation Chat Box */}
            <div className="border p-4 rounded mb-6 h-80 overflow-y-auto shadow-lg">
              <p className="font-semibold text-lg mb-3">Conversation:</p>
              {messages.map((msg, idx) => (
                <div key={idx} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-3 py-2 rounded ${msg.role === 'user' ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-900'} text-base`}>
                    {msg.text}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
  
            {/* Conversation Input (for manual messaging) */}
            <div className="flex items-center">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your message here..."
                className={`w-full h-24 p-4 border rounded text-base resize-none focus:outline-none transition-all duration-200 shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
              />
              {/* Show Send button only if autoSend is OFF */}
              {!autoSend && (
                <button
                  onClick={() => {
                    if (interviewMode) {
                      interviewWithAI();
                    } else {
                      analyzeWithAI();
                    }
                  }}
                  disabled={isLoading || ttsLoading || !input.trim()}
                  className="ml-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md shadow-lg transition text-base"
                >
                  Send Message
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
