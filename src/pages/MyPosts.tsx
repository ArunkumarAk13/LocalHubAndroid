import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@/contexts/AuthContext";
import Navigation from '@/components/Navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChevronLeft, Trash, CheckCircle, Loader2, Star } from 'lucide-react';
import { postsAPI, chatsAPI, ratingsAPI } from '@/api';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/api/config';

interface Post {
  id: string;
  title: string;
  description: string;
  category: string;
  images: string[];
  created_at: string;
  location: string;
  purchased: boolean;
  postedBy: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
  };
}

interface ChatParticipant {
  id: string;
  name: string;
  avatar: string;
}

const MyPosts: React.FC = () => {
  const navigate = useNavigate();
  const { toast: useToastToast } = useToast();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [chatParticipants, setChatParticipants] = useState<ChatParticipant[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  
  // Load user posts
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const response = await postsAPI.getUserPosts(String(user.id));
        if (response.success) {
          setPosts(response.posts.map((post: any) => ({
            id: post.id,
            title: post.title,
            description: post.description,
            category: post.category,
            images: post.images,
            created_at: post.created_at,
            location: post.location || 'Unknown',
            purchased: post.purchased || false,
            postedBy: post.posted_by
          })));
          setError(null);
        } else {
          useToastToast({
            title: "Error",
            description: "Failed to load your posts",
            variant: "destructive"
          });
          setError("Failed to load posts");
        }
      } catch (err) {
        console.error("Error fetching posts:", err);
        useToastToast({
          title: "Error",
          description: "Failed to load your posts",
          variant: "destructive"
        });
        setError("Failed to load posts");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user, navigate, useToastToast]);

  const handleDeletePost = async (postId: string) => {
    try {
      const response = await postsAPI.deletePost(postId);
      if (response.success) {
        setPosts(posts.filter(post => post.id !== postId));
        useToastToast({
          title: "Success",
          description: "Post deleted successfully"
        });
      } else {
        useToastToast({
          title: "Error",
          description: "Failed to delete post",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      useToastToast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    }
  };

  const loadChatParticipants = async (postId: string) => {
    try {
      setLoadingParticipants(true);
      const response = await chatsAPI.getAllChats();
      
      if (response.success && Array.isArray(response.chats)) {
        // Extract unique participants from all chats
        const uniqueParticipants: Record<string, ChatParticipant> = {};
        
        response.chats.forEach((chat: any) => {
          // Add participant to the unique list if they're not already there
          if (chat.participant_id && chat.participant_id !== user?.id) {
            uniqueParticipants[chat.participant_id] = {
              id: chat.participant_id,
              name: chat.participant_name,
              avatar: chat.participant_avatar
            };
          }
        });
        
        // Convert to array
        const participants = Object.values(uniqueParticipants);
        setChatParticipants(participants);
        
        if (participants.length === 0) {
          toast.info("No chat participants found");
        }
      } else {
        toast.error("Failed to load participants");
      }
    } catch (error) {
      console.error("Error loading chat participants:", error);
      toast.error("Error loading participants");
    } finally {
      setLoadingParticipants(false);
    }
  };

  const openPurchaseDialog = async (postId: string) => {
    setSelectedPostId(postId);
    setSelectedSellerId(null);
    setSelectedRating(0);
    setIsPurchaseDialogOpen(true);
    
    // Load chat participants for this post
    await loadChatParticipants(postId);
  };

  const handleMarkAsPurchased = async () => {
    if (!selectedPostId || !selectedSellerId) {
      toast.error("Please select who you purchased from");
      return;
    }

    try {
      const response = await postsAPI.markAsPurchased(
        selectedPostId, 
        selectedSellerId,
        selectedRating > 0 ? selectedRating : undefined
      );
      
      if (response.success) {
        setPosts(posts.map(post => 
          post.id === selectedPostId ? { ...post, purchased: true } : post
        ));
        setIsPurchaseDialogOpen(false);
        useToastToast({
          title: "Success",
          description: "Post marked as purchased"
        });
      } else {
        useToastToast({
          title: "Error",
          description: "Failed to mark post as purchased",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error marking post as purchased:", err);
      useToastToast({
        title: "Error",
        description: "Failed to mark post as purchased",
        variant: "destructive"
      });
    }
  };

  const handleRemovePurchased = async (postId: string) => {
    try {
      const response = await postsAPI.markAsPurchased(postId); // Reuse the same endpoint
      if (response.success) {
        setPosts(posts.map(post => 
          post.id === postId ? { ...post, purchased: false } : post
        ));
        useToastToast({
          title: "Success",
          description: "Post marked as available"
        });
      } else {
        useToastToast({
          title: "Error",
          description: "Failed to update post status",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Error updating post status:", err);
      useToastToast({
        title: "Error",
        description: "Failed to update post status",
        variant: "destructive"
      });
    }
  };

  const getImageUrl = (url: string) => {
    console.log('Getting image URL for:', url);
    if (!url) return 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=500&auto=format&fit=crop';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/uploads/post-images/${url}`;
  };

  const getAvatarUrl = (url: string) => {
    if (!url) return "https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=";
    if (url.startsWith('blob:')) return url;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  // Rating stars component
  const renderRatingStars = (selectedRate: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={24}
            className={`cursor-pointer ${
              star <= selectedRate
                ? "text-yellow-500 fill-yellow-500"
                : "text-gray-300"
            }`}
            onClick={() => setSelectedRating(star)}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[90vh] bg-background overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="mr-2 pl-0" 
            onClick={() => navigate('/profile')}
          >
            <ChevronLeft size={16} />
          </Button>
          <h1 className="text-2xl font-bold">My Posts</h1>
        </div>
        
        {posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map(post => (
              <Card 
                key={post.id} 
                className="flex flex-row overflow-hidden cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => navigate(`/post/${post.id}`)}
              >
                <div className="relative w-32 h-32 flex-shrink-0">
                  {post.images && post.images.length > 0 && (
                    <img
                      src={getImageUrl(post.images[0])}
                      alt={post.title}
                      className="w-full h-full object-contain bg-gray-50"
                    />
                  )}
                  <Badge variant={post.purchased ? "secondary" : "default"} className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5">
                    {post.purchased ? "Purchased" : post.category}
                  </Badge>
                </div>
                <div className="flex-1 flex flex-col p-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-base mb-0.5 line-clamp-1">{post.title}</h3>
                    <p className="text-[10px] text-gray-500 mb-0.5">Location: {post.location}</p>
                    <p className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${post.id}/edit`);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePost(post.id);
                      }}
                    >
                      Delete
                    </Button>
                    {post.purchased ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePurchased(post.id);
                        }}
                      >
                        Remove Purchased
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPurchaseDialog(post.id);
                        }}
                      >
                        Mark as Purchased
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-3">You haven't created any posts yet</p>
            <Button onClick={() => navigate('/post')}>Create a Post</Button>
          </div>
        )}
      </div>
      
      {/* Purchase Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Item as Purchased</DialogTitle>
            <DialogDescription>
              Select who you purchased this item from and rate your experience with them.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {loadingParticipants ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : chatParticipants.length > 0 ? (
              <>
                <h4 className="text-sm font-medium mb-2">From whom did you purchase this item?</h4>
                <ScrollArea className="h-[240px] pr-4">
                  <div className="space-y-2">
                    {chatParticipants.map(participant => (
                      <div
                        key={participant.id}
                        className={`flex items-center p-3 rounded-md cursor-pointer ${
                          selectedSellerId === participant.id 
                            ? 'bg-accent border border-primary' 
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => setSelectedSellerId(participant.id)}
                      >
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarImage src={getAvatarUrl(participant.avatar)} />
                          <AvatarFallback>
                            {participant.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{participant.name}</p>
                        </div>
                        {selectedSellerId === participant.id && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>No chat participants found</p>
                <p className="text-sm mt-2">You must have active conversations to mark a post as purchased</p>
              </div>
            )}
            
            {selectedSellerId && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-2">Rate your experience (optional)</h4>
                <div className="flex items-center space-x-2">
                  {renderRatingStars(selectedRating)}
                  <span className="text-sm text-muted-foreground ml-2">
                    {selectedRating > 0 ? `${selectedRating}/5` : 'No rating'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPurchaseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPurchased}
              disabled={!selectedSellerId || chatParticipants.length === 0}
            >
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Navigation />
    </div>
  );
};

export default MyPosts;
