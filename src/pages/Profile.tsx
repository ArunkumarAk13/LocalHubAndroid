import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { FileImage, Edit, Bell, Pencil, Upload, Settings as SettingsIcon, MapPin } from "lucide-react";
import { usersAPI } from "@/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import Settings from "@/components/Settings";
import { API_BASE_URL } from '@/api/config';

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [myPosts, setMyPosts] = useState([]);
  const [subscribedCategories, setSubscribedCategories] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    avatar: user?.avatar || "",
    phoneNumber: user?.phone_number || "",
    location: user?.location || ""
  });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Fetch my posts and subscribed categories on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        try {
          console.log('Fetching profile data for user:', user.id);
          const [profileResponse, categoriesResponse] = await Promise.all([
            usersAPI.getUserProfile(user.id.toString()),
            usersAPI.getSubscribedCategories()
          ]);
          
          console.log('Profile response:', profileResponse);
          
          if (profileResponse.success) {
            // Update user data with the latest information
            if (user) {
              console.log('Updating user data with:', profileResponse.user);
              user.name = profileResponse.user.name;
              user.avatar = profileResponse.user.avatar;
              user.phone_number = profileResponse.user.phone_number;
              user.location = profileResponse.user.location;
              user.created_at = profileResponse.user.created_at;
              console.log('Updated user data:', user);
            }
            setMyPosts(Array(profileResponse.user.postCount || 0).fill(null));
          }
          
          if (categoriesResponse.success && Array.isArray(categoriesResponse.categories)) {
            setSubscribedCategories(categoriesResponse.categories);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Failed to load profile data");
        }
      }
    };

    fetchData();
  }, [user]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a preview URL for the selected image
      const imageUrl = URL.createObjectURL(file);
      console.log('Created preview URL:', imageUrl);
      setEditForm(prev => ({ ...prev, avatar: imageUrl }));
    }
  };

  const handleEditProfile = async () => {
    if (!editForm.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('phoneNumber', editForm.phoneNumber);
      formData.append('location', editForm.location);

      // If a new file was selected, append it to formData
      const fileInput = fileInputRef.current;
      if (fileInput?.files?.[0]) {
        console.log('Appending avatar file to form data:', fileInput.files[0]);
        formData.append('avatar', fileInput.files[0]);
      }

      const apiUrl = `${API_BASE_URL}/api/users/profile`;
      console.log('Sending profile update request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Profile update response:', result);

      if (result.success) {
        // Update user data with the response
        if (user) {
          user.name = result.user.name;
          user.avatar = result.user.avatar;
          user.phone_number = result.user.phone_number;
          user.location = result.user.location;
        }
        setIsEditDialogOpen(false);
        toast.success("Profile updated successfully");
      } else {
        throw new Error(result.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = (url: string) => {
    if (!url) return 'https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads')) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/uploads/avatars/${url}`;
  };

  return (
    <div className="pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col items-center text-center border-b pb-6 relative">
            <div className="h-24 w-24 rounded-full overflow-hidden mb-4 relative group">
              <img
                src={getAvatarUrl(user?.avatar)}
                alt="Profile"
                className="h-full w-full object-cover"
              />
              <div 
                className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Pencil className="text-white" size={24} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-bold">{user?.name || "User Name"}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Pencil size={16} />
              </Button>
            </div>
            <p className="text-muted-foreground">{user?.phone_number || "No phone number"}</p>
            {user?.location && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(user.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {user.location}
                </a>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Account Information</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User ID:</span>
                    <span>{user?.id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined:</span>
                    <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'May 2, 2025'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium">Activity</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Posts:</span>
                    <span>{myPosts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Responses:</span>
                    <span>0</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium">Subscribed Categories</h3>
                <div className="mt-2">
                  {subscribedCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {subscribedCategories.map((category) => (
                        <Badge key={category} variant="accent" className="flex items-center gap-1">
                          <Bell size={14} />
                          {category}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No categories subscribed yet</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="border-t pt-6 flex flex-col gap-4">
            <Button 
              onClick={() => navigate('/my-posts')}
              className="w-full flex items-center gap-2"
            >
              <FileImage size={16} /> My Posts
            </Button>
            
            <Button 
              onClick={() => setIsSettingsOpen(true)}
              variant="outline" 
              className="w-full flex items-center gap-2"
            >
              <SettingsIcon size={16} /> Settings
            </Button>
            
            <Button 
              onClick={logout}
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <div className="h-32 w-32 rounded-full overflow-hidden relative group">
                <img
                  src={getAvatarUrl(editForm.avatar)}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
                <div 
                  className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="text-white" size={24} />
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <Upload size={16} /> Change Photo
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="Your phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Your location"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProfile} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your account settings and preferences
            </DialogDescription>
          </DialogHeader>
          <Settings onClose={() => setIsSettingsOpen(false)} open={isSettingsOpen} />
        </DialogContent>
      </Dialog>
      
      <Navigation />
    </div>
  );
};

export default Profile;
