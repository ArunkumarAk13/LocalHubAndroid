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
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [userHasRated, setUserHasRated] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

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
          
          // Check if user has already rated this post
          if (response.post.ratings && user) {
            const userRating = response.post.ratings.find((r: any) => r.userId === user.id);
            setUserHasRated(!!userRating);
          }
          
          // Get all ratings for this post
          const ratingsResponse = await ratingsAPI.getPostRatings(postId);
          if (ratingsResponse.success) {
            setRatings(ratingsResponse.ratings);
          }

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

  const handleAddRating = async () => {
    if (selectedRating === 0) {
      toast("Please select a rating");
      return;
    }
    
    try {
      const response = await ratingsAPI.addRating(postId!, selectedRating, ratingComment);
      
      if (response.success) {
        toast("Rating added successfully");
        setShowRatingDialog(false);
        setSelectedRating(0);
        setRatingComment('');
        setUserHasRated(true);
        
        // Refresh ratings
        const ratingsResponse = await ratingsAPI.getPostRatings(postId!);
        if (ratingsResponse.success) {
          setRatings(ratingsResponse.ratings);
        }
      } else {
        toast(response.message || "Failed to add rating");
      }
    } catch (error: any) {
      console.error("Error adding rating:", error);
      toast(error.response?.data?.message || "Error adding rating");
    }
  };

  const handleEdit = async () => {
    try {
      const response = await postsAPI.updatePost(postId!, {
        title: editedTitle,
        description: editedDescription
      });
      
      if (response.success) {
        setPost({ ...post, title: editedTitle, description: editedDescription });
        setIsEditing(false);
        toast("Post updated successfully");
      } else {
        toast(response.message || "Failed to update post");
      }
    } catch (error: any) {
      console.error("Error updating post:", error);
      toast(error.response?.data?.message || "Error updating post");
    }
  };

  const renderRatingStars = (rating: number = 0, interactive = false) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={interactive ? 24 : 16}
            className={`${
              star <= rating
                ? "text-accent fill-accent"
                : "text-muted-foreground"
            } ${interactive ? 'cursor-pointer hover:text-accent' : ''}`}
            onClick={interactive ? () => setSelectedRating(star) : undefined}
          />
        ))}
      </div>
    );
  };

  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? post.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === post.images.length - 1 ? 0 : prev + 1
    );
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

  const canRatePost = user && post.posted_by.id !== user.id && !userHasRated;

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
                    onClick={handlePreviousImage}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={handleNextImage}
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
              {renderRatingStars(post.posted_by.rating)}
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
            
            {canRatePost && (
              <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Star className="mr-2 h-4 w-4" /> Rate Post
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rate this post</DialogTitle>
                    <DialogDescription>
                      Share your experience with this post by rating it and adding a comment
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="flex justify-center mb-4">
                      {renderRatingStars(selectedRating, true)}
                    </div>
                    <Textarea
                      placeholder="Add a comment (optional)"
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowRatingDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddRating}>Submit Rating</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Ratings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ratings & Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {ratings.length > 0 ? (
                <div className="space-y-4">
                  {ratings.map((rating: any) => (
                    <div key={rating.id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center mb-2">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarImage src={rating.user.avatar} alt={rating.user.name} />
                          <AvatarFallback>{rating.user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{rating.user.name}</p>
                          <div className="flex items-center">
                            {renderRatingStars(rating.rating)}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {new Date(rating.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-sm pl-10">{rating.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No ratings yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Navigation />
    </div>
  );
};

export default PostDetail;
