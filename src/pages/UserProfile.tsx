import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from 'sonner';
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Star, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usersAPI, ratingsAPI, postsAPI } from "@/api";

interface UserData {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  postCount: number;
  createdAt?: string;
  badges?: string[];
}

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [userPosts, setUserPosts] = useState([]);

  // Fetch user data
  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }
    
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await usersAPI.getUserProfile(userId);
        
        if (response.success) {
          setUserData({
            id: response.user.id,
            name: response.user.name,
            avatar: response.user.avatar || 'https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=',
            rating: response.user.rating || 0,
            postCount: response.user.postCount || 0,
            createdAt: response.user.created_at,
            badges: ['Verified']
          });
          
          // Fetch user posts
          const postsResponse = await postsAPI.getUserPosts(userId);
          if (postsResponse.success) {
            setUserPosts(postsResponse.posts);
          }
        } else {
          toast("Failed to load user profile");
          navigate('/');
        }
      } catch (error) {
        console.error("Error loading user profile:", error);
        toast("Error loading user profile");
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [userId, navigate]);
  
  const handleReport = () => {
    if (!reportReason) {
      toast("Please provide a reason for reporting");
      return;
    }
    
    // In a real app, this would submit the report to a backend
    toast("Report submitted. Thank you for helping keep our community safe");
    setReportReason('');
  };

  // Rating stars display
  const renderRatingStars = (rating: number = 0) => {
    // Ensure rating is always a number before using toFixed
    const numericRating = typeof rating === 'number' ? rating : Number(rating) || 0;
    
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            size={20}
            className={`${
              index < Math.round(numericRating)
                ? "text-accent fill-accent"
                : "text-muted-foreground"
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">({numericRating.toFixed(1)})</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>User not found</p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col items-center text-center border-b pb-6">
            <div className="h-24 w-24 rounded-full overflow-hidden mb-4">
              <img
                src={userData.avatar}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </div>
            <CardTitle className="text-2xl font-bold">{userData.name}</CardTitle>
            
            <div className="mt-2">
              {renderRatingStars(userData.rating)}
            </div>
            
            {/* User badges */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {userData.badges?.map(badge => (
                <Badge key={badge} variant="accent">{badge}</Badge>
              ))}
            </div>
          </CardHeader>
          
          <CardContent className="py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">User Activity</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined:</span>
                    <span>{userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'May 2025'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Posts:</span>
                    <span>{userData.postCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="border-t pt-6 flex flex-col gap-4">
            <Button 
              onClick={() => navigate(-1)}
              variant="outline" 
              className="w-full"
            >
              Back
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full flex items-center gap-2"
                >
                  <Flag size={16} /> Report User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report User</DialogTitle>
                  <DialogDescription>
                    Help us understand why you're reporting {userData.name}. Your report will be reviewed by our team.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="reportReason" className="mb-2 block">Reason for reporting</Label>
                  <Textarea 
                    id="reportReason"
                    placeholder="Please explain why you're reporting this user"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReportReason('')}>Cancel</Button>
                  <Button variant="destructive" onClick={handleReport}>Submit Report</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>
      
      <Navigation />
    </div>
  );
};

export default UserProfile;
