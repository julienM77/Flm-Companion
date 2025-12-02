import { useState, useEffect, useRef } from 'react';
import { Send, StopCircle, Play, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FlmService } from '../../services/flm';
import type { FlmModel, ServerOptions } from '../../types';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatViewProps {
    models: FlmModel[];
    selectedModel: string;
    onSelectModel: (model: string) => void;
    options: ServerOptions;
    setOptions: (options: ServerOptions) => void;
}

export const ChatView = ({ models, selectedModel, onSelectModel, options, setOptions }: ChatViewProps) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Refs to access state inside the event listener callback
    const isReadyRef = useRef(isReady);
    const isThinkingRef = useRef(isThinking);

    useEffect(() => {
        isReadyRef.current = isReady;
    }, [isReady]);

    useEffect(() => {
        isThinkingRef.current = isThinking;
    }, [isThinking]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const handleStart = async () => {
        if (!selectedModel) return;

        setMessages([{ role: 'system', content: t('chat.system_starting', { model: selectedModel }) }]);
        setIsRunning(true);
        setIsReady(false);

        try {
            await FlmService.startChat(selectedModel, options, (data) => {
                // Handle output from FLM
                if (data.type === 'stdout') {
                    const text = data.content || '';

                    // Check for ready state
                    if (text.includes('>>>')) {
                        setIsReady(true);
                        setIsThinking(false);
                        // Remove the prompt from display if it's just the prompt
                        if (text.trim() === '>>>') return;
                    }

                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        const ready = isReadyRef.current;
                        const thinking = isThinkingRef.current;

                        // If last message is assistant, append to it
                        if (lastMsg && lastMsg.role === 'assistant' && !ready) {
                            // Filter out the prompt if it appears in the chunk
                            const cleanContent = text.replace('>>>', '');
                            return [
                                ...prev.slice(0, -1),
                                { ...lastMsg, content: lastMsg.content + cleanContent }
                            ];
                        }

                        // If it's a new response starting
                        if (thinking && (!lastMsg || lastMsg.role !== 'assistant')) {
                            const cleanContent = text.replace('>>>', '');
                            return [...prev, { role: 'assistant', content: cleanContent }];
                        }

                        // System messages or initial logs
                        if (!ready && (!lastMsg || lastMsg.role === 'system')) {
                            return [...prev, { role: 'system', content: text }];
                        }

                        return prev;
                    });
                } else if (data.type === 'stderr') {
                    // Usually logs
                    const text = data.content || '';
                    setMessages(prev => [...prev, { role: 'system', content: `[LOG] ${text}` }]);
                } else if (data.type === 'exit') {
                    setIsRunning(false);
                    setIsReady(false);
                    setMessages(prev => [...prev, { role: 'system', content: t('chat.system_process_exited', { code: data.code }) }]);
                }
            });
        } catch (e) {
            console.error(e);
            setIsRunning(false);
            setMessages(prev => [...prev, { role: 'system', content: t('chat.system_error', { error: e }) }]);
        }
    };

    const handleStop = async () => {
        await FlmService.stopChat();
        setIsRunning(false);
        setIsReady(false);
    };

    const handleSend = async () => {
        if (!input.trim() || !isReady) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsReady(false);
        setIsThinking(true);

        // Create a new empty assistant message to stream into
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        await FlmService.sendChatMessage(userMsg);
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

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowOptions(!showOptions)}
                        className={showOptions ? "bg-accent" : ""}
                        title={t('chat.settings')}
                    >
                        <Settings2 className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {!isRunning ? (
                        <Button onClick={handleStart} disabled={!selectedModel}>
                            <Play className="w-4 h-4 mr-2" />
                            {t('chat.start_chat')}
                        </Button>
                    ) : (
                        <Button variant="destructive" onClick={handleStop}>
                            <StopCircle className="w-4 h-4 mr-2" />
                            {t('chat.stop')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Options Panel */}
            {showOptions && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">{t('chat.advanced_parameters')}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('chat.power_mode')}</Label>
                                <Select
                                    value={options.pmode}
                                    onValueChange={(v: any) => setOptions({ ...options, pmode: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="powersaver">{t('chat.power_modes.powersaver')}</SelectItem>
                                        <SelectItem value="balanced">{t('chat.power_modes.balanced')}</SelectItem>
                                        <SelectItem value="performance">{t('chat.power_modes.performance')}</SelectItem>
                                        <SelectItem value="turbo">{t('chat.power_modes.turbo')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('chat.context_length')}</Label>
                                <Input
                                    type="number"
                                    value={options.ctxLen}
                                    onChange={e => setOptions({ ...options, ctxLen: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="asr-mode">{t('chat.asr_mode')}</Label>
                                <Switch
                                    id="asr-mode"
                                    checked={options.asr}
                                    onChange={e => setOptions({ ...options, asr: e.target.checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="embed-mode">{t('chat.embed_mode')}</Label>
                                <Switch
                                    id="embed-mode"
                                    checked={options.embed}
                                    onChange={e => setOptions({ ...options, embed: e.target.checked })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

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
