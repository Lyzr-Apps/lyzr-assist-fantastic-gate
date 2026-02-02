import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send } from 'lucide-react'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'

// =============================================================================
// TypeScript Interfaces - Based on REAL test response data
// =============================================================================

interface AgentResult {
  answer: string
  sources: string[]
  confidence: number
  suggested_action: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: string[]
  confidence?: number
  suggestedAction?: string
}

// =============================================================================
// Constants
// =============================================================================

const AGENT_ID = '69809580066158e77fdea161'
const LOGO_URL = 'https://asset.lyzr.app/1LGIpawt'

const PREDEFINED_QUESTIONS = [
  'How do I get started with Lyzr?',
  'How do I choose the right model?',
  'What APIs are available for agents?',
  'Where can I find tutorials?',
  'What is Lyzr Agent Lab?',
]

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Welcome to Lyzr Support Agent! I can help you find information about the Lyzr platform, tutorials, API documentation, and getting started guides. Ask me anything!',
  timestamp: new Date().toISOString(),
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// =============================================================================
// Sub-Components (defined outside Home to prevent re-creation on render)
// =============================================================================

function Header() {
  return (
    <header className="bg-[#27272A] border-b border-[#3f3f46] px-6 py-4 flex items-center gap-4">
      <img src={LOGO_URL} alt="Lyzr Logo" className="h-8 w-auto" />
      <h1 className="text-xl font-semibold text-[#F3EFEA] font-inter">
        Support Agent
      </h1>
    </header>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-[#F3EFEA] text-[#27272A]'
            : 'bg-[#27272A] text-[#F3EFEA] border border-[#3f3f46]'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* Sources - only for assistant messages */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-[#F3EFEA]/60 font-medium">Sources:</div>
            {message.sources.map((source, idx) => (
              <a
                key={idx}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-[#F3EFEA] underline hover:text-[#F3EFEA]/80 transition-colors"
              >
                {source}
              </a>
            ))}
          </div>
        )}

        {/* Confidence badge - only for assistant messages */}
        {!isUser && typeof message.confidence === 'number' && (
          <div className="mt-2">
            <Badge
              variant="outline"
              className="bg-[#F3EFEA]/10 text-[#F3EFEA] border-[#F3EFEA]/20 text-xs"
            >
              Confidence: {Math.round(message.confidence * 100)}%
            </Badge>
          </div>
        )}

        {/* Suggested action - only for assistant messages */}
        {!isUser && message.suggestedAction && (
          <div className="mt-3 pt-3 border-t border-[#F3EFEA]/10">
            <div className="text-xs text-[#F3EFEA]/60 font-medium mb-1">
              Suggested Next Step:
            </div>
            <div className="text-sm text-[#F3EFEA]/90">{message.suggestedAction}</div>
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs mt-2 ${isUser ? 'text-[#27272A]/60' : 'text-[#F3EFEA]/40'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-[#27272A] text-[#F3EFEA] border border-[#3f3f46]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Searching documentation...</span>
        </div>
      </div>
    </div>
  )
}

function QuestionChip({ question, onClick }: { question: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-4 py-2 rounded-full border border-[#F3EFEA] text-[#F3EFEA] text-sm bg-[#27272A] hover:bg-[#F3EFEA] hover:text-[#27272A] transition-all duration-200 font-inter whitespace-nowrap"
    >
      {question}
    </button>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-red-900/20 text-red-200 border border-red-500/30">
        <div className="text-sm">
          <strong>Error:</strong> {message}
        </div>
        <div className="text-xs mt-2 text-red-200/60">
          Contact Lyzr support at support@lyzr.ai
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const result = await callAIAgent(messageText, AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const agentResult = result.response.result as AgentResult

        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: agentResult.answer || 'I received your question but could not generate a response.',
          timestamp: new Date().toISOString(),
          sources: agentResult.sources || [],
          confidence: agentResult.confidence,
          suggestedAction: agentResult.suggested_action,
        }

        setMessages((prev) => [...prev, assistantMessage])
      } else {
        // Error from agent
        const errorMsg =
          result.response?.message || result.error || 'Failed to get response from agent'
        setError(errorMsg)

        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `I encountered an issue: ${errorMsg}\n\nPlease try again or contact Lyzr support at support@lyzr.ai`,
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error occurred'
      setError(errorMsg)

      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `An error occurred: ${errorMsg}\n\nPlease check your connection and try again. If the issue persists, contact Lyzr support at support@lyzr.ai`,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuestionClick = (question: string) => {
    handleSendMessage(question)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSendMessage(inputValue)
  }

  return (
    <div className="min-h-screen bg-[#27272A] flex flex-col font-inter">
      {/* Header */}
      <Header />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isLoading && <TypingIndicator />}

            {error && !isLoading && <ErrorMessage message={error} />}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Predefined Questions */}
        <div className="px-6 py-3 bg-[#27272A] border-t border-[#3f3f46]">
          <div className="max-w-4xl mx-auto">
            <ScrollArea className="w-full" orientation="horizontal">
              <div className="flex gap-2 pb-2">
                {PREDEFINED_QUESTIONS.map((question, idx) => (
                  <QuestionChip
                    key={idx}
                    question={question}
                    onClick={() => handleQuestionClick(question)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Input Bar */}
        <div className="px-6 py-4 bg-[#27272A] border-t border-[#3f3f46]">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleFormSubmit} className="flex gap-3">
              <Input
                type="text"
                placeholder="Ask a question about Lyzr..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-[#27272A] border-[#3f3f46] text-[#F3EFEA] placeholder:text-[#F3EFEA]/40 focus-visible:ring-[#F3EFEA]/20"
              />
              <Button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="bg-[#F3EFEA] text-[#27272A] hover:bg-[#F3EFEA]/90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
