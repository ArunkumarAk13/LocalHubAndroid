import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Star, MessageCircle, Phone } from 'lucide-react';
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
  const [showContactDialog, setShowContactDialog] = React.useState(false);
  const [showChatBox, setShowChatBox] = React.useState(false);
  const [currentChat, setCurrentChat] = React.useState<{ id: string; participant: any } | null>(null);
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on profile section, contact button, or if dialog is open
    if ((e.target as HTMLElement).closest('.profile-section') || 
        (e.target as HTMLElement).closest('.contact-button') ||
        showContactDialog) {
      return;
    }
    navigate(`/post/${id}`);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('WhatsApp settings:', {
      whatsappEnabled: postedBy.settings?.whatsappEnabled,
      phoneNumber: postedBy.phone_number
    });
    if (postedBy.phone_number) {
      const formattedNumber = postedBy.phone_number.replace(/\D/g, '');
      const whatsappNumber = formattedNumber.startsWith('91') ? formattedNumber : `91${formattedNumber}`;
      window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    } else {
      toast.error("User's phone number is not available");
    }
    setShowContactDialog(false);
  };

  const handleLHChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chat?participantId=${postedBy.id}`);
    setShowContactDialog(false);
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
          <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
            <DialogTrigger asChild>
              <Button 
                variant="default" 
                size="sm" 
                className="bg-brand-500 hover:bg-brand-600 text-xs px-2 py-1 h-6 mt-1 contact-button"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Contact button clicked, settings:', {
                    whatsappEnabled: postedBy.settings?.whatsappEnabled,
                    phoneNumber: postedBy.phone_number,
                    settings: postedBy.settings
                  });
                  setShowContactDialog(true);
                }}
              >
                Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Choose Contact Method</DialogTitle>
                <DialogDescription>
                  Select how you would like to contact {postedBy.name}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {postedBy.settings?.whatsappEnabled && postedBy.phone_number && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleWhatsApp}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleLHChat}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  LH Chat
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

      {showChatBox && currentChat && (
        <div className="fixed bottom-4 right-4 z-50">
          <ChatBox
            chatId={currentChat.id}
            participant={currentChat.participant}
            onClose={() => setShowChatBox(false)}
          />
        </div>
      )}
    </>
  );
};

export default NeedCard;
