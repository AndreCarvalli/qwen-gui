const React = require('react');
const ReactDOM = require('react-dom');
const { useState, useEffect, useRef } = React;
const { Send, Bot, User, Settings, Trash2, Cpu } = require('lucide-react');
const axios = require('axios');
const ReactMarkdown = require('react-markdown');
const remarkGfm = require('remark-gfm');

const App = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [model, setModel] = useState('qwen2.5-coder:1.5b');
    const [ollamaStatus, setOllamaStatus] = useState('checking');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        checkOllamaStatus();
    }, []);

    const checkOllamaStatus = async () => {
        try {
            await axios.get('http://localhost:11434/api/tags');
            setOllamaStatus('online');
        } catch (e) {
            setOllamaStatus('offline');
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await axios({
                method: 'post',
                url: 'http://localhost:11434/api/generate',
                data: {
                    model: model,
                    prompt: input,
                    stream: true
                },
                responseType: 'stream'
            });

            // For Electron/Node env, the response is a readable stream
            let assistantMessage = { role: 'assistant', content: '' };
            setMessages(prev => [...prev, assistantMessage]);

            let fullContent = "";
            
            // Note: In a real Electron browser environment, we'd use fetch() 
            // but for this prototype renderer, we simulate the streaming read
            // because axios responseType 'stream' behaves differently in renderer.
            // We will use the native fetch API for better streaming support in the frontend.
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Could not connect to Ollama. Make sure it is running.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Redefining sendMessage to use fetch for better streaming in Electron frontend
    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: input,
                    stream: true
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantText = "";
            
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (!line) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.response) {
                            assistantText += json.response;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1].content = assistantText;
                                return newMessages;
                            });
                        }
                    } catch (e) {}
                }
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to Ollama. Is it running?' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-[#1e293b] flex flex-col border-r border-slate-700">
                <div className="p-4 flex items-center gap-2 font-bold text-white border-b border-slate-700">
                    <Bot className="w-6 h-6 text-blue-400" />
                    <span>Qwen GUI</span>
                </div>
                
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Model</label>
                        <select 
                            value={model} 
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full bg-[#0f172a] border border-slate-600 rounded-md p-2 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="qwen2.5-coder:1.5b">Qwen2.5 Coder 1.5B</option>
                            <option value="qwen2.5-coder:7b">Qwen2.5 Coder 7B</option>
                            <option value="llama3">Llama 3</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-md bg-[#0f172a] border border-slate-700">
                        <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-slate-300">Ollama {ollamaStatus === 'online' ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700">
                    <button 
                        onClick={() => setMessages([])}
                        className="w-full flex items-center justify-center gap-2 p-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Chat
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative">
                {/* Header */}
                <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0f172a]/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-400">{model}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <Bot className="w-12 h-12 text-blue-400" />
                            <div className="max-w-sm">
                                <h2 className="text-xl font-semibold text-white">Hello! I'm Qwen</h2>
                                <p className="text-sm text-slate-400">Ask me to write code, fix bugs, or just chat. I'm running locally via Ollama.</p>
                            </div>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-blue-300" />}
                            </div>
                            <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-700 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
                                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
                        <input 
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-6 pr-14 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-200 placeholder-slate-500 shadow-xl"
                        />
                        <button 
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-all"
                        >
                            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </form>
                    <p className="text-center text-[10px] text-slate-500 mt-3">
                        Running locally with Ollama. Data never leaves your machine.
                    </p>
                </div>
            </div>
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
