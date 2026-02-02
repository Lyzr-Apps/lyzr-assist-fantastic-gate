import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, Plus, MessageSquare } from 'lucide-react'
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

interface Conversation {
  id: string
  title: string
  timestamp: number
  messages: Message[]
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

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function generateConversationTitle(firstMessage: string): string {
  const maxLength = 30
  const trimmed = firstMessage.trim()
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.substring(0, maxLength) + '...'
}

// =============================================================================
// LocalStorage Functions
// =============================================================================

const STORAGE_KEY = 'lyzr-support-conversations'

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (err) {
    console.error('Failed to load conversations:', err)
  }
  return []
}

function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
  } catch (err) {
    console.error('Failed to save conversations:', err)
  }
}

// =============================================================================
// Sub-Components (defined outside Home to prevent re-creation on render)
// =============================================================================

function Header() {
  return (
    <header className="bg-[#4A2F2D] border-b border-[#5a3f3d] px-6 py-4 flex items-center gap-4">
      <img src={LOGO_URL} alt="Lyzr Logo" className="h-8 w-auto" />
      <h1 className="text-xl font-semibold text-[#E3D0C2] font-inter">
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
            ? 'bg-[#E3D0C2] text-[#4A2F2D]'
            : 'bg-[#4A2F2D] text-[#E3D0C2] border border-[#5a3f3d]'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* Sources - only for assistant messages */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-[#E3D0C2]/60 font-medium">Sources:</div>
            {message.sources.map((source, idx) => (
              <a
                key={idx}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-[#E3D0C2] underline hover:text-[#E3D0C2]/80 transition-colors"
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
              className="bg-[#E3D0C2]/10 text-[#E3D0C2] border-[#E3D0C2]/20 text-xs"
            >
              Confidence: {Math.round(message.confidence * 100)}%
            </Badge>
          </div>
        )}

        {/* Suggested action - only for assistant messages */}
        {!isUser && message.suggestedAction && (
          <div className="mt-3 pt-3 border-t border-[#E3D0C2]/10">
            <div className="text-xs text-[#E3D0C2]/60 font-medium mb-1">
              Suggested Next Step:
            </div>
            <div className="text-sm text-[#E3D0C2]/90">{message.suggestedAction}</div>
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs mt-2 ${isUser ? 'text-[#4A2F2D]/60' : 'text-[#E3D0C2]/40'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-[#4A2F2D] text-[#E3D0C2] border border-[#5a3f3d]">
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
      className="flex-shrink-0 px-4 py-2 rounded-full border border-[#E3D0C2] text-[#E3D0C2] text-sm bg-[#4A2F2D] hover:bg-[#E3D0C2] hover:text-[#4A2F2D] transition-all duration-200 font-inter whitespace-nowrap"
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

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group ${
        isActive
          ? 'bg-[#E3D0C2] text-[#4A2F2D]'
          : 'bg-[#4A2F2D] text-[#E3D0C2] hover:bg-[#5a3f3d]'
      }`}
    >
      <div className="flex items-start gap-2">
        <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{conversation.title}</div>
          <div
            className={`text-xs mt-1 ${
              isActive ? 'text-[#4A2F2D]/60' : 'text-[#E3D0C2]/50'
            }`}
          >
            {formatRelativeTime(conversation.timestamp)}
          </div>
        </div>
      </div>
    </button>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations())
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
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

  // Save current conversation to localStorage whenever messages change
  useEffect(() => {
    if (currentConversationId && messages.length > 1) {
      const updatedConversations = conversations.map((conv) => {
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            messages,
            timestamp: Date.now(),
            title: conv.title === 'New Chat' && messages.length > 1
              ? generateConversationTitle(messages.find(m => m.role === 'user')?.content || 'New Chat')
              : conv.title,
          }
        }
        return conv
      })

      setConversations(updatedConversations)
      saveConversations(updatedConversations)
    }
  }, [messages, currentConversationId])

  const createNewChat = () => {
    const newConversation: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Chat',
      timestamp: Date.now(),
      messages: [WELCOME_MESSAGE],
    }

    const updatedConversations = [newConversation, ...conversations]
    setConversations(updatedConversations)
    saveConversations(updatedConversations)
    setCurrentConversationId(newConversation.id)
    setMessages([WELCOME_MESSAGE])
    setError(null)
  }

  const loadConversation = (conversationId: string) => {
    const conversation = conversations.find((c) => c.id === conversationId)
    if (conversation) {
      setCurrentConversationId(conversationId)
      setMessages(conversation.messages)
      setError(null)
    }
  }

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    // If no active conversation, create one
    if (!currentConversationId) {
      const newConversation: Conversation = {
        id: `conv-${Date.now()}`,
        title: generateConversationTitle(messageText),
        timestamp: Date.now(),
        messages: [WELCOME_MESSAGE],
      }
      const updatedConversations = [newConversation, ...conversations]
      setConversations(updatedConversations)
      saveConversations(updatedConversations)
      setCurrentConversationId(newConversation.id)
    }

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
    <div className="min-h-screen bg-[#4A2F2D] flex flex-col font-inter">
      {/* Header */}
      <Header />

      {/* Main Content Area - Sidebar + Chat */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation History Sidebar */}
        <aside className="w-64 bg-[#3a241f] border-r border-[#5a3f3d] flex flex-col">
          {/* New Chat Button */}
          <div className="p-4 border-b border-[#5a3f3d]">
            <Button
              onClick={createNewChat}
              className="w-full bg-[#E3D0C2] text-[#4A2F2D] hover:bg-[#E3D0C2]/90 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>

          {/* History Header */}
          <div className="px-4 py-3 border-b border-[#5a3f3d]">
            <h2 className="text-sm font-semibold text-[#E3D0C2] uppercase tracking-wide">
              Conversation History
            </h2>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-[#E3D0C2]/50 text-sm">
                  No conversations yet.<br />Start a new chat!
                </div>
              ) : (
                conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === currentConversationId}
                    onClick={() => loadConversation(conversation.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Chat Area */}
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
          <div className="px-6 py-3 bg-[#4A2F2D] border-t border-[#5a3f3d]">
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
          <div className="px-6 py-4 bg-[#4A2F2D] border-t border-[#5a3f3d]">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleFormSubmit} className="flex gap-3">
                <Input
                  type="text"
                  placeholder="Ask a question about Lyzr..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-[#4A2F2D] border-[#5a3f3d] text-[#E3D0C2] placeholder:text-[#E3D0C2]/40 focus-visible:ring-[#E3D0C2]/20"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-[#E3D0C2] text-[#4A2F2D] hover:bg-[#E3D0C2]/90"
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
    </div>
  )
}
