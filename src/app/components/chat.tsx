'use client'

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useChat } from "ai/react"
import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User, Send, Sparkles } from 'lucide-react'

export function Chat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();
    const chatParent = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const domNode = chatParent.current
        if (domNode) {
            domNode.scrollTop = domNode.scrollHeight
        }
    }, [messages])

    return (
        <main className="flex flex-col w-full h-screen max-h-dvh bg-background text-foreground">
            {/* Header */}
            <header className="px-6 py-4 border-b flex items-center justify-between w-full max-w-4xl mx-auto">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">AI Assistant</h1>
                        <p className="text-xs text-muted-foreground">Powered by Groq</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                    </span>
                </div>
            </header>

            {/* Messages Area */}
            <section className="flex-1 overflow-hidden flex flex-col w-full max-w-4xl mx-auto p-4 md:p-6">
                <div 
                    ref={chatParent} 
                    className="flex-1 overflow-y-auto pr-2 space-y-6 scroll-smooth"
                >
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                            <div className="p-3 rounded-2xl bg-muted text-muted-foreground">
                                <Bot className="w-8 h-8" />
                            </div>
                            <div className="space-y-1 max-w-sm">
                                <h3 className="font-medium text-base">Como posso ajudar você hoje?</h3>
                                <p className="text-sm text-muted-foreground">
                                    Faça perguntas sobre qualquer assunto, peça sugestões ou peça para resumir textos.
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((m) => {
                            const isUser = m.role === 'user'

                            return (
                                <div
                                    key={m.id}
                                    className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    {/* Bot Avatar */}
                                    {!isUser && (
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}

                                    {/* Message Bubble */}
                                    <div
                                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] md:max-w-[75%] shadow-sm ${
                                            isUser
                                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                                : 'bg-muted/70 text-foreground border border-border/50 rounded-tl-sm'
                                        }`}
                                    >
                                        {isUser ? (
                                            <p className="whitespace-pre-wrap">{m.content}</p>
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 [&>li]:my-0.5">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

                                    {/* User Avatar */}
                                    {isUser && (
                                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}

                    {isLoading && (
                        <div className="flex gap-3.5 justify-start">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="rounded-2xl px-4 py-3 bg-muted/70 border border-border/50 text-sm flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Input Bar (Fixed at bottom) */}
            <footer className="p-4 border-t bg-background/80 backdrop-blur w-full">
                <form 
                    onSubmit={handleSubmit} 
                    className="flex w-full max-w-4xl mx-auto items-center gap-2"
                >
                    <Input 
                        className="flex-1 h-11 px-4 rounded-xl border-input bg-muted/30 focus-visible:ring-1" 
                        placeholder="Digite sua pergunta aqui..." 
                        type="text" 
                        value={input} 
                        onChange={handleInputChange} 
                    />
                    <Button 
                        className="h-11 px-4 rounded-xl flex items-center gap-2" 
                        type="submit"
                        disabled={isLoading || !input.trim()}
                    >
                        <span>Enviar</span>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </footer>
        </main>
    )
}
