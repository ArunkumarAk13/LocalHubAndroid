import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import ChatBox from './ChatBox';
import { API_BASE_URL } from '@/api/config';

export interface NeedCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  postedBy: {
    id: string;
    name: string;
    avatar: string;
    phone_number: string;
    settings?: {
      whatsappEnabled: boolean;
    };
  };
  postedAt: string;
  location: string;
  onProfileClick: (userId: string) => void;
}

const NeedCard: React.FC<NeedCardProps> = ({
  id,
  title,
  description,
  category,
  image,
  postedBy,
  postedAt,
  location,
  onProfileClick
}) => {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = React.useState(false);

  const handleCardClick = () => {
    navigate(`/post/${id}`);
  };

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsChatOpen(true);
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!postedBy.phone_number) {
      toast.error("Phone number not available");
      return;
    }
    window.location.href = `tel:${postedBy.phone_number}`;
  };

  const getImageUrl = (url: string) => {
    if (!url) return 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=500&auto=format&fit=crop';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/uploads/post-images/${url}`;
  };

  return (
    <>
      <Card 
        className="overflow-hidden w-full flex flex-col cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="relative w-full h-48 overflow-hidden">
          {image && (
          <img 
            src={getImageUrl(image)} 
            alt={title}
              className="w-full h-full object-contain bg-gray-50"
          />
          )}
          <Badge variant="default" className="absolute top-2 right-2">
            {category}
          </Badge>
        </div>
        <CardContent className="p-2">
          <h3 className="font-bold text-sm line-clamp-1 mb-1">{title}</h3>
          <p className="text-xs text-gray-500 truncate">Location: {location}</p>
        </CardContent>
        <CardFooter className="hidden min-[550px]:flex p-2 pt-0 justify-between items-center border-t mt-auto">
          <div 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 profile-section"
            onClick={(e) => {
              e.stopPropagation();
              onProfileClick(postedBy.id);
            }}
          >
            <Avatar className="h-5 w-5">
              <AvatarImage src={postedBy.avatar} alt={postedBy.name} />
              <AvatarFallback>{postedBy.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium">{postedBy.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleChatClick}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePhoneClick}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Chat with {postedBy.name}</DialogTitle>
            <DialogDescription>
              Send a message to discuss this need
            </DialogDescription>
          </DialogHeader>
          <ChatBox
            chatId={postedBy.id}
            participant={postedBy}
            onClose={() => setIsChatOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NeedCard;
