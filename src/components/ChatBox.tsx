import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { API_BASE_URL } from '@/api/config';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface ChatParticipant {
  id: string;
  name: string;
  avatar: string;
}

interface ChatBoxProps {
  chatId: string;
  participant: ChatParticipant;
  onClose: () => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ chatId, participant, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
    // Set up polling for new messages
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [chatId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const sentMessage = await response.json();
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <Card className="flex flex-col h-[500px] w-[350px] shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center p-4 border-b">
        <Avatar className="h-8 w-8">
          <AvatarImage src={participant.avatar} />
          <AvatarFallback>{participant.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <h3 className="ml-3 font-semibold">{participant.name}</h3>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender_id === user?.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p>{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {format(new Date(message.created_at), 'HH:mm')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex items-center space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
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
  );
};

export default ChatBox; 