import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Search, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from '@/api/config';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface Chat {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_avatar: string;
  last_message: string;
  created_at: string;
  unread_count: number;
}

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get('chatId');
  const participantId = searchParams.get('participantId');
  const [selectedChat, setSelectedChat] = useState<string | null>(chatId);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatDetails, setCurrentChatDetails] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch all chats and set current chat details
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch chats');
        const data = await response.json();
        setChats(data);
        
        // If we have a selected chat ID, find its details from the chats list
        if (selectedChat) {
          const chatDetails = data.find((chat: Chat) => chat.id === selectedChat);
          if (chatDetails) {
            setCurrentChatDetails(chatDetails);
          }
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };

    fetchChats();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Handle new chat creation
  useEffect(() => {
    const createNewChat = async () => {
      if (!participantId || selectedChat) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ participantId }),
        });

        if (!response.ok) throw new Error('Failed to create chat');
        const newChat = await response.json();
        setSelectedChat(newChat.id);
        setCurrentChatDetails(newChat);
        navigate(`/chat?chatId=${newChat.id}`, { replace: true });
      } catch (error) {
        console.error('Error creating chat:', error);
        navigate('/chat');
      }
    };

    createNewChat();
  }, [participantId, selectedChat, navigate]);

  // Auto-scroll to bottom when new messages arrive or when chat is opened
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedChat]);

  // Fetch messages for selected chat
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat) return;
      setIsLoadingMessages(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats/${selectedChat}/messages`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch messages");
        const data = await response.json();
        setMessages(data);

        // Mark messages as read
        await fetch(`${API_BASE_URL}/api/chats/${selectedChat}/read`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        // Scroll to bottom after messages are loaded
        setTimeout(() => {
          const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }, 100);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${selectedChat}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ content: message }),
      });

      if (!response.ok) throw new Error("Failed to send message");
      
      const sentMessage = await response.json();
      setMessages(prev => [...prev, sentMessage]);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleBackToChats = () => {
    setSelectedChat(null);
    navigate('/chat');
  };

  const filteredChats = chats.filter(chat =>
    chat.participant_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    chat.participant_id !== user?.id // Filter out current user's chat
  );

  if (!selectedChat) {
    return (
      <div className="containerr mx-auto h-screen">
        <Card className="h-full">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">Your Chats</h2>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <ScrollArea className="h-screen">
            <div className="p-4 space-y-4">
              {filteredChats.length > 0 ? (
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center gap-4 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedChat(chat.id);
                      navigate(`/chat?chatId=${chat.id}`);
                    }}
                  >
                    <Avatar>
                      <AvatarImage src={chat.participant_avatar} />
                      <AvatarFallback>
                        {chat.participant_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium truncate">{chat.participant_name}</h3>
                        {chat.unread_count > 0 && (
                          <span className="ml-2 h-5 w-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.last_message || "No messages yet"}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(chat.created_at), "MMM d")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No chats found" : "No chats yet"}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    );
  }

  return (
    <div className="containerr mx-auto h-screen">
      <Card className="flex flex-col h-full">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToChats}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar>
              <AvatarImage src={currentChatDetails?.participant_avatar} />
              <AvatarFallback>
                {currentChatDetails?.participant_name?.slice(0, 2).toUpperCase() || "..."}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">
                {currentChatDetails?.participant_name}
              </h2>
            </div>
          </div>
        </div>
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_id === user?.id ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.sender_id === user?.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p>{msg.content}</p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No messages yet</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <form onSubmit={handleSendMessage} className="p-4 border-t">
          <div className="flex items-center space-x-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!message.trim()}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Chat; 