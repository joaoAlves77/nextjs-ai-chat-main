'use client'

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useChat } from "ai/react"
import { useRef, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, User, Send, Sparkles, ImagePlus, X } from 'lucide-react'
import { decodeUserContent, encodeUserContent } from '@/lib/chat-media'

const MAX_IMAGES = 3
const MAX_EDGE = 1280

type PendingImage = {
    id: string
    url: string
}

async function compressImage(file: File) {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', 0.85)
}

function ImageStack({ urls, light }: { urls: string[]; light?: boolean }) {
    if (!urls.length) return null

    return (
        <div className={`grid gap-2 ${urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {urls.map((url, index) => (
                <img
                    key={`${index}-${url.length}`}
                    src={url}
                    alt={`Foto ${index + 1}`}
                    className={`max-h-72 w-full rounded-xl object-contain ${light ? 'bg-black/10' : 'bg-background'}`}
                />
            ))}
        </div>
    )
}

export function Chat() {
    const { messages, input, handleInputChange, append, setInput, isLoading, error } = useChat();
    const chatParent = useRef<HTMLDivElement>(null)
    const fileInput = useRef<HTMLInputElement>(null)
    const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
    const [attachmentError, setAttachmentError] = useState<string | null>(null)
    const [isCompressing, setIsCompressing] = useState(false)

    useEffect(() => {
        const domNode = chatParent.current
        if (domNode) {
            domNode.scrollTop = domNode.scrollHeight
        }
    }, [messages, pendingImages, isLoading])

    async function addFiles(files: FileList | File[]) {
        const list = Array.from(files).filter((file) => file.type.startsWith('image/'))
        if (!list.length) {
            setAttachmentError('Escolha um arquivo de imagem.')
            return
        }

        const room = MAX_IMAGES - pendingImages.length
        if (room <= 0) {
            setAttachmentError(`Você pode enviar até ${MAX_IMAGES} fotos por mensagem.`)
            return
        }

        setAttachmentError(null)
        setIsCompressing(true)
        try {
            const next = list.slice(0, room)
            const urls = await Promise.all(next.map((file) => compressImage(file)))
            setPendingImages((current) => [
                ...current,
                ...urls.map((url) => ({ id: crypto.randomUUID(), url })),
            ])
            if (list.length > room) {
                setAttachmentError(`Você pode enviar até ${MAX_IMAGES} fotos por mensagem.`)
            }
        } catch {
            setAttachmentError('Não consegui ler essa imagem.')
        } finally {
            setIsCompressing(false)
            if (fileInput.current) fileInput.current.value = ''
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const text = input.trim()
        if (isLoading || isCompressing || (!text && pendingImages.length === 0)) return

        const content = encodeUserContent(
            text,
            pendingImages.map((image) => image.url),
        )
        setInput('')
        setPendingImages([])
        setAttachmentError(null)
        await append({ role: 'user', content })
    }

    return (
        <main className="flex flex-col w-full h-screen max-h-dvh bg-background text-foreground">
            <header className="px-6 py-4 border-b flex items-center justify-between w-full max-w-4xl mx-auto">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Visagismo</h1>
                        <p className="text-xs text-muted-foreground">Avaliação do rosto pela foto</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                    </span>
                </div>
            </header>

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
                                <h3 className="font-medium text-base">Envie uma foto do rosto</h3>
                                <p className="text-sm text-muted-foreground">
                                    Anexe a imagem e escreva o que quer avaliar: corte, maquiagem, óculos ou cores.
                                </p>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isUser = message.role === 'user'
                            const decoded = isUser ? decodeUserContent(message.content) : null
                            const text = decoded?.text ?? message.content
                            const images = decoded?.images ?? []

                            return (
                                <div
                                    key={message.id}
                                    className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    {!isUser && (
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}

                                    <div
                                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] md:max-w-[75%] shadow-sm space-y-3 ${
                                            isUser
                                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                                : 'bg-muted/70 text-foreground border border-border/50 rounded-tl-sm'
                                        }`}
                                    >
                                        <ImageStack urls={images} light={isUser} />
                                        {isUser ? (
                                            text ? <p className="whitespace-pre-wrap">{text}</p> : null
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 [&>li]:my-0.5">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {text}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

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

            <footer className="p-4 border-t bg-background/80 backdrop-blur w-full">
                <form
                    onSubmit={onSubmit}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                        event.preventDefault()
                        if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
                    }}
                    onPaste={(event) => {
                        const files = Array.from(event.clipboardData.files)
                        if (files.length) void addFiles(files)
                    }}
                    className="flex w-full max-w-4xl mx-auto flex-col gap-2"
                >
                    {pendingImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {pendingImages.map((image) => (
                                <div key={image.id} className="relative">
                                    <img src={image.url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                                    <button
                                        type="button"
                                        className="absolute -top-1.5 -right-1.5 rounded-full bg-background border shadow-sm p-0.5"
                                        aria-label="Remover imagem"
                                        onClick={() => setPendingImages((current) => current.filter((item) => item.id !== image.id))}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {(attachmentError || error) && (
                        <p className="text-xs text-destructive">{attachmentError || error?.message}</p>
                    )}

                    <div className="flex w-full items-center gap-2">
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                                if (event.target.files?.length) void addFiles(event.target.files)
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 w-11 rounded-xl shrink-0"
                            aria-label="Anexar foto"
                            disabled={isLoading || isCompressing}
                            onClick={() => fileInput.current?.click()}
                        >
                            <ImagePlus className="w-4 h-4" />
                        </Button>
                        <Input
                            className="flex-1 h-11 px-4 rounded-xl border-input bg-muted/30 focus-visible:ring-1"
                            placeholder="Diga o que quer avaliar na foto..."
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                        />
                        <Button
                            className="h-11 px-4 rounded-xl flex items-center gap-2"
                            type="submit"
                            disabled={isLoading || isCompressing || (!input.trim() && pendingImages.length === 0)}
                        >
                            <span>Enviar</span>
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </form>
            </footer>
        </main>
    )
}
