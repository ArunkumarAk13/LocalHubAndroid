import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Star, FileImage, Edit, Bell, Pencil, Upload, Settings as SettingsIcon, MapPin } from "lucide-react";
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
    city: user?.city || "",
    district: user?.district || "",
    state: user?.state || "",
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
              user.city = profileResponse.user.city;
              user.district = profileResponse.user.district;
              user.state = profileResponse.user.state;
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
      formData.append('city', editForm.city);
      formData.append('district', editForm.district);
      formData.append('state', editForm.state);

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
        toast.success("Profile updated successfully");
        setIsEditDialogOpen(false);
        // Reset form
        setEditForm({
          name: result.user.name,
          avatar: result.user.avatar,
          phoneNumber: result.user.phone_number,
          city: result.user.city,
          district: result.user.district,
          state: result.user.state
        });
        // Update the user context
        if (user) {
          user.name = result.user.name;
          user.avatar = result.user.avatar;
          user.phone_number = result.user.phone_number;
          user.city = result.user.city;
          user.district = result.user.district;
          user.state = result.user.state;
        }
      } else {
        throw new Error(result.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            // Use reverse geocoding to get address
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude.toString()}&lon=${longitude.toString()}`
            );
            const data = await response.json();
            const address = data.display_name;
            setEditForm(prev => ({ ...prev, location: address }));
          } catch (error) {
            console.error('Error getting address:', error);
            toast.error('Failed to get address from coordinates');
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          let errorMessage = 'Failed to get current location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your device settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Please try again.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = 'An unknown error occurred while getting location.';
          }
          
          toast.error(errorMessage);
        },
        options
      );
    } else {
      toast.error('Geolocation is not supported by your browser or device');
    }
  };

  // Cleanup function to revoke object URLs when component unmounts or when dialog closes
  useEffect(() => {
    return () => {
      // Revoke any object URLs created for previews
      if (editForm.avatar && editForm.avatar.startsWith('blob:')) {
        console.log('Revoking blob URL:', editForm.avatar);
        URL.revokeObjectURL(editForm.avatar);
      }
    };
  }, [editForm.avatar]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isEditDialogOpen) {
      setEditForm({
        name: user?.name || "",
        avatar: user?.avatar || "",
        phoneNumber: user?.phone_number || "",
        city: user?.city || "",
        district: user?.district || "",
        state: user?.state || ""
      });
    }
  }, [isEditDialogOpen, user]);

  const getAvatarUrl = (url: string) => {
    console.log('Getting avatar URL for:', url);
    if (!url) return "https://media.istockphoto.com/id/1495088043/vector/user-profile-icon-avatar-or-person-icon-profile-picture-portrait-symbol-default-portrait.jpg?s=612x612&w=0&k=20&c=dhV2p1JwmloBTOaGAtaA3AW1KSnjsdMt7-U_3EZElZ0=";
    if (url.startsWith('blob:')) return url;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  const testNotification = async (type: string) => {
    try {
      console.log('Sending test notification of type:', type);
      const response = await usersAPI.post('/api/users/test-notification', { type });
      
      if (response.success) {
        toast.success(response.message || 'Test notification sent!');
      } else {
        // Create detailed error object
        const errorDetails = {
          type,
          response: {
            message: response.message,
            error: response.error
          }
        };
        
        // Log stringified error details
        console.error('Test notification error:', JSON.stringify(errorDetails, null, 2));
        
        // Display a user-friendly error message
        const errorMessage = response.error?.data?.message || 
                           response.message || 
                           'Failed to send test notification';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      // Create detailed error object
      const errorDetails = {
        type,
        error: {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        }
      };
      
      // Log stringified error details
      console.error('Error sending test notification:', JSON.stringify(errorDetails, null, 2));
      
      // Display a user-friendly error message
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to send test notification';
      toast.error(errorMessage);
    }
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
            {user?.city && user?.district && user?.state ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${user.city}, ${user.district}, ${user.state}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {`${user.city}, ${user.district}, ${user.state}`}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">Add location for better experience</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="h-6 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                >
                  Add Now
                </Button>
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
                placeholder="+1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={editForm.city}
                onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Enter your city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={editForm.district}
                onChange={(e) => setEditForm(prev => ({ ...prev, district: e.target.value }))}
                placeholder="Enter your district"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={editForm.state}
                onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                placeholder="Enter your state"
              />
            </div>
            {(!editForm.city || !editForm.district || !editForm.state) && (
              <div className="text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 mb-2">
                Please add your city, district, and state for accurate location-based filtering.
              </div>
            )}
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
