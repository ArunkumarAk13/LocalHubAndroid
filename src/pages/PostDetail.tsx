import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Star, ArrowLeft, MessageSquare, ChevronLeft, ChevronRight, Phone, MessageCircle, Edit2 } from 'lucide-react';
import { postsAPI, ratingsAPI, usersAPI } from '@/api';
import { API_BASE_URL } from '@/api/config';

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return;
      
      try {
        setLoading(true);
        const response = await postsAPI.getPostById(postId);
        
        if (response.success) {
          setPost(response.post);
          setEditedTitle(response.post.title);
          setEditedDescription(response.post.description);
          
          // Get poster's WhatsApp settings
          if (response.post.posted_by.id) {
            const settingsResponse = await usersAPI.getUserProfile(response.post.posted_by.id);
            if (settingsResponse.success) {
              setWhatsappEnabled(settingsResponse.user.settings?.whatsappEnabled || false);
            }
          }
        } else {
          toast("Post not found");
          navigate('/');
        }
      } catch (error) {
        console.error("Error loading post:", error);
        toast("Error loading post details");
      } finally {
        setLoading(false);
      }
    };
    
    loadPost();
  }, [postId, navigate, user]);

  const handleEdit = async () => {
    try {
      const formData = new FormData();
      formData.append('title', editedTitle);
      formData.append('description', editedDescription);
      formData.append('category', post.category);
      if (post.location) {
        formData.append('location', post.location);
      }

      // Handle existing images
      if (post.images && post.images.length > 0) {
        formData.append('existingImages', JSON.stringify(post.images));
      }

      const response = await postsAPI.updatePost(postId!, formData);
      
      if (response.success) {
        setPost(response.post);
        setIsEditing(false);
        toast.success("Post updated successfully");
      } else {
        toast.error(response.message || "Failed to update post");
      }
    } catch (error: any) {
      console.error("Error updating post:", error);
      toast.error(error.response?.data?.message || "Error updating post");
    }
  };

  const handleWhatsApp = () => {
    if (post?.posted_by?.phone_number) {
      const formattedNumber = post.posted_by.phone_number.replace(/\D/g, '');
      const whatsappNumber = formattedNumber.startsWith('91') ? formattedNumber : `91${formattedNumber}`;
      window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    } else {
      toast.error("User's phone number is not available");
    }
    setShowContactDialog(false);
  };

  const handleLHChat = () => {
    navigate(`/chat?participantId=${post.posted_by.id}`);
    setShowContactDialog(false);
  };

  const getImageUrl = (url: string) => {
    console.log('Getting image URL for:', url);
    if (!url) return 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=500&auto=format&fit=crop';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/uploads/post-images/${url}`;
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % post.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + post.images.length) % post.images.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-20 flex items-center justify-center">
        <p>Loading post details...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen pb-20 flex items-center justify-center">
        <p>Post not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          className="mb-4 pl-0"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="mb-6">
          <div className="relative rounded-lg overflow-hidden mb-4">
            <div className="relative aspect-[4/3] bg-gray-50">
              {post.images && post.images.length > 0 && (
                <>
                  <img 
                    src={getImageUrl(post.images[currentImageIndex])} 
                    alt={`${post.title} - Image ${currentImageIndex + 1}`} 
                    className="w-full h-full object-contain" 
                  />
                  {post.images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImage();
                        }}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImage();
                        }}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {post.images.map((_, index) => (
                          <div
                            key={index}
                            className={`w-2 h-2 rounded-full ${
                              index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <Badge className="absolute top-4 right-4" variant="accent">
              {post.category}
            </Badge>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full text-2xl font-bold p-2 border rounded"
              />
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full min-h-[200px]"
              />
              <div className="flex gap-2">
                <Button onClick={handleEdit}>Save Changes</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start">
          <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              </div>
          
          <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{post.location}</span>
            <span className="mx-2">•</span>
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
          
          <div className="flex items-center mb-6 cursor-pointer" onClick={() => navigate(`/profile/${post.posted_by.id}`)}>
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={post.posted_by.avatar} alt={post.posted_by.name} />
              <AvatarFallback>{post.posted_by.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{post.posted_by.name}</p>
            </div>
          </div>

          <div className="bg-background rounded-lg p-4 border mb-6">
            <p className="whitespace-pre-line">{post.description}</p>
          </div>
            </>
          )}

          <div className="flex space-x-2 mb-6">
            {user && post.posted_by.id !== user.id && (
              <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-brand-500 hover:bg-brand-600">
                    <MessageSquare className="mr-2 h-4 w-4" /> Contact Poster
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Choose Contact Method</DialogTitle>
                    <DialogDescription>
                      Select how you would like to contact {post.posted_by.name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {whatsappEnabled && post.posted_by.phone_number && (
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
            )}
          </div>
        </div>
      </div>
      
      <Navigation />
    </div>
  );
};

export default PostDetail;
