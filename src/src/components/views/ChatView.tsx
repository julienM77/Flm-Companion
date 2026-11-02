import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FlmService } from '../../services/flm';
import type { FlmModel, ServerStatus } from '../../types';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatViewProps {
    models: FlmModel[];
    selectedModel: string;
    onSelectModel: (model: string) => void;
    serverStatus: ServerStatus;
}

const API_BASE_URL = 'http://127.0.0.1:52626/v1';
const CAVEMAN_INSTRUCTION = 'Speak like caveman. Ultra-short. Omit filler words. Maximum information density with minimal tokens.';

export const ChatView = ({ models, selectedModel, onSelectModel, serverStatus }: ChatViewProps) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [cavemanMode, setCavemanMode] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (serverStatus === 'running') {
            setIsRunning(true);
            setIsReady(true);
        } else if (serverStatus === 'starting') {
            setIsRunning(true);
            setIsReady(false);
        } else {
            setIsRunning(false);
            setIsReady(false);
        }
    }, [serverStatus]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const handleSend = async () => {
        if (!input.trim() || !isReady) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsReady(false);
        setIsThinking(true);

        // Create a new empty assistant message to stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            if (serverStatus === 'running') {
                const history = [
                    ...(cavemanMode ? [{ role: 'system' as const, content: CAVEMAN_INSTRUCTION }] : []),
                    ...messages.filter(message => message.role !== 'system'),
                    { role: 'user' as const, content: userMsg },
                ];
                const response = await fetch(`${API_BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedModel, messages: history, stream: true }),
                });
                if (!response.ok || !response.body) throw new Error(`API request failed (${response.status})`);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        const payload = line.slice(5).trim();
                        if (payload === '[DONE]') continue;
                        try {
                            const content = JSON.parse(payload).choices?.[0]?.delta?.content;
                            if (content) setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: (prev[prev.length - 1]?.content || '') + content }]);
                        } catch { }
                    }
                }
                setIsReady(true);
                setIsThinking(false);
            } else {
                await FlmService.sendChatMessage(userMsg);
            }
        } catch (e) {
            setIsReady(true);
            setIsThinking(false);
            setMessages(prev => [...prev, { role: 'system', content: t('chat.system_error', { error: e }) }]);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header / Controls */}
            <div className="flex items-center gap-4 p-4 bg-card rounded-xl border shadow-sm">
                <div className="flex-1 flex items-center gap-4">
                    <Select
                        value={selectedModel}
                        onValueChange={onSelectModel}
                        disabled={isRunning}
                    >
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder={t('chat.select_model')} />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map(model => (
                                <SelectItem key={model.name} value={model.name}>
                                    {model.name} ({model.size})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                        <Switch checked={cavemanMode} onCheckedChange={setCavemanMode} />
                        {t('chat.caveman_mode')}
                    </label>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        disabled
                        className={cn(
                            'gap-2',
                            serverStatus === 'running' && 'border-green-500/40 bg-green-500/10 text-green-400 opacity-100',
                            serverStatus === 'starting' && 'border-blue-500/40 bg-blue-500/10 text-blue-400 opacity-100',
                            serverStatus === 'stopped' && 'border-red-500/40 bg-red-500/10 text-red-400 opacity-100',
                        )}
                    >
                        <span className={cn(
                            'h-2 w-2 rounded-full',
                            serverStatus === 'running' && 'bg-green-400',
                            serverStatus === 'starting' && 'bg-blue-400 animate-pulse',
                            serverStatus === 'stopped' && 'bg-red-400',
                        )} />
                        {serverStatus === 'running' ? t('chat.server_ready') : serverStatus === 'starting' ? t('chat.server_starting') : t('chat.server_offline')}
                    </Button>
                </div>
            </div>

            {/* Chat Area */}
            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4 max-w-3xl mx-auto">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex w-full",
                                    msg.role === 'user' ? "justify-end" : "justify-start",
                                    msg.role === 'system' ? "justify-center" : ""
                                )}
                            >
                                <div className={cn(
                                    "rounded-lg px-4 py-2 max-w-[80%]",
                                    msg.role === 'user'
                                        ? "bg-primary text-primary-foreground"
                                        : msg.role === 'assistant'
                                            ? "bg-muted"
                                            : "bg-transparent text-xs text-muted-foreground font-mono"
                                )}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-lg px-4 py-2">
                                    <span className="animate-pulse">...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t bg-background/50 backdrop-blur supports-backdrop-filter:bg-background/50">
                    <div className="max-w-3xl mx-auto flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isReady ? t('chat.type_message') : isRunning ? t('chat.waiting_model') : t('chat.start_model_to_chat')}
                            disabled={!isReady}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={!isReady || !input.trim()}
                            size="icon"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
