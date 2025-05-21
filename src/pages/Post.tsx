import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from "@/contexts/AuthContext";
import Navigation from '@/components/Navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Images, FilePlus, Search, Loader2 } from 'lucide-react';
import { postsAPI } from '@/api';
import { Capacitor } from '@capacitor/core';
import { Platform } from 'react-native';
import { Camera, CameraResultType } from '@capacitor/camera';

const CATEGORIES = [
  // Electronics & Gadgets
  'Smartphones', 'Laptops', 'Tablets', 'Desktop Computers', 'Gaming Consoles',
  'Smart Watches', 'Headphones', 'Speakers', 'Cameras', 'TVs & Monitors',
  'Printers', 'Routers', 'Power Banks', 'Chargers', 'Cables & Adapters',
  
  // Home & Furniture
  'Sofas & Couches', 'Beds & Mattresses', 'Tables', 'Chairs', 'Wardrobes',
  'Kitchen Appliances', 'Home Decor', 'Lighting', 'Curtains & Blinds',
  'Garden Furniture', 'Storage Solutions',
  
  // Clothing & Fashion
  'Men\'s Clothing', 'Women\'s Clothing', 'Kids\' Clothing', 'Footwear',
  'Accessories', 'Jewelry', 'Watches', 'Bags & Backpacks', 'Sportswear',
  'Traditional Wear',
  
  // Vehicles & Transportation
  'Cars', 'Motorcycles', 'Bicycles', 'Auto Parts', 'Vehicle Accessories',
  'Car Electronics', 'Tires & Wheels', 'Vehicle Maintenance',
  
  // Books & Education
  'Textbooks', 'Fiction Books', 'Non-Fiction Books', 'Educational Materials',
  'Stationery', 'Art Supplies', 'Musical Instruments',
  
  // Sports & Fitness
  'Sports Equipment', 'Fitness Gear', 'Exercise Machines', 'Sports Wear',
  'Outdoor Gear', 'Camping Equipment',
  
  // Services
  'Home Services', 'Professional Services', 'Educational Services',
  'Health & Wellness', 'Beauty & Personal Care', 'Cleaning Services',
  'Repair & Maintenance', 'Transportation Services',
  
  // Others
  'Toys & Games', 'Pet Supplies', 'Baby Products', 'Health Products',
  'Beauty Products', 'Food & Beverages', 'Office Supplies',
  'Industrial Equipment', 'Agricultural Supplies'
];

const MAX_PHOTOS = 5;

const Post = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    images: [] as {file: File, preview: string, isExisting?: boolean, url?: string}[],
  });

  useEffect(() => {
    if (postId) {
      setIsLoading(true);
      postsAPI.getPostById(postId)
        .then(response => {
          if (response.success) {
            const post = response.post;
            setFormData({
              title: post.title,
              description: post.description,
              category: post.category,
              location: post.location || '',
              images: post.images.map((url: string) => ({
                preview: url,
                url: url,
                isExisting: true
              }))
            });
          } else {
            toast.error("Failed to load post");
            navigate('/');
          }
        })
        .catch(error => {
          console.error('Error loading post:', error);
          toast.error("Failed to load post");
          navigate('/');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [postId, navigate]);

  const filteredCategories = CATEGORIES.filter(category =>
    category.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      try {
        // Use Capacitor Camera plugin for native platforms
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: true,
          resultType: CameraResultType.DataUrl,
          source: 'PHOTOLIBRARY'
        });

        if (image.dataUrl) {
          const existingImages = formData.images.filter(img => img.isExisting);
          const newImages = [...formData.images.filter(img => !img.isExisting)];
          
          if (existingImages.length + newImages.length < MAX_PHOTOS) {
            newImages.push({
              preview: image.dataUrl,
              file: null
            });
            
            setFormData(prev => ({ 
              ...prev, 
              images: [...existingImages, ...newImages]
            }));
          } else {
            toast.error(`Maximum photos reached. You can only upload up to ${MAX_PHOTOS} photos`);
          }
        }
      } catch (error) {
        console.error('Error selecting image:', error);
        toast.error('Failed to select image');
      }
    } else {
      // Web platform handling
      const files = e.target.files;
      if (files && files.length > 0) {
        const existingImages = formData.images.filter(img => img.isExisting);
        const newImages = [...formData.images.filter(img => !img.isExisting)];
        
        for (let i = 0; i < files.length; i++) {
          if (existingImages.length + newImages.length < MAX_PHOTOS) {
            const file = files[i];
            if (!file.type.startsWith('image/')) {
              toast.error('Please select only image files');
              continue;
            }
            
            const blob = new Blob([file], { type: file.type });
            const preview = URL.createObjectURL(blob);
            
            newImages.push({
              file: file,
              preview: preview
            });
          } else {
            toast.error(`Maximum photos reached. You can only upload up to ${MAX_PHOTOS} photos`);
            break;
          }
        }
        
        setFormData(prev => ({ 
          ...prev, 
          images: [...existingImages, ...newImages]
        }));
        e.target.value = '';
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!formData.title.trim() || !formData.description.trim() || !formData.category) {
        toast.show({
          title: 'Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      // Create FormData
      const postData = new FormData();
      postData.append('title', formData.title.trim());
      postData.append('description', formData.description.trim());
      postData.append('category', formData.category);
      if (formData.location) {
        postData.append('location', formData.location.trim());
      }

      // Handle images
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        // For native platforms, convert images to base64
        const base64Images = [];
        for (const image of formData.images) {
          if (image.preview) {
            try {
              // For native platforms, the preview URL is already a base64 string
              const base64Data = image.preview.split(',')[1];
              if (base64Data) {
                base64Images.push(base64Data);
              }
            } catch (error) {
              console.error('Error processing image:', error);
            }
          }
        }
        console.log('Converted images to base64:', base64Images.length);
        postData.append('images', JSON.stringify(base64Images));
      } else {
        // For web, append files directly
        formData.images.forEach((image, index) => {
          if (image.file) {
            const filename = `image-${Date.now()}-${index}.jpg`;
            postData.append('images', {
              uri: URL.createObjectURL(image.file),
              type: 'image/jpeg',
              name: filename,
            } as any);
          }
        });
      }

      // Log the final FormData contents
      console.log('Submitting post with data:', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: formData.location,
        imagesCount: formData.images.length,
        platform: isNative ? 'native' : 'web',
        hasImages: formData.images.length > 0,
        imagePreviews: formData.images.map(img => ({
          hasPreview: !!img.preview,
          previewLength: img.preview?.length || 0
        }))
      });

      let response;
      if (postId) {
        response = await postsAPI.updatePost(postId, postData);
      } else {
        response = await postsAPI.createPost(postData);
      }

      if (response.success) {
        toast.success(postId ? "Post updated successfully!" : "Your need has been posted successfully!");
        navigate(postId ? `/post/${postId}` : '/');
      } else {
        throw new Error(response.message || 'Failed to save post');
      }
    } catch (error: any) {
      console.error('Error saving post:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        platform: Capacitor.getPlatform(),
        formData: {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          imagesCount: formData.images.length,
          images: formData.images.map(img => ({
            hasPreview: !!img.preview,
            hasFile: !!img.file,
            hasUrl: !!img.url,
            previewLength: img.preview?.length || 0
          }))
        }
      });
      
      // Show more specific error message
      const errorMessage = error.response?.data?.message || error.message || "Failed to save post. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleMarkAsPurchased = async (rating: number, comment?: string) => {
    try {
      const response = await markPostAsPurchased(post.id, rating, comment);
      toast.success('Post marked as purchased and rated successfully');
      // Refresh the post data
      fetchPost();
    } catch (error: any) {
      console.error('Error marking post as purchased:', error);
      toast.error(error.response?.data?.message || 'Failed to mark post as purchased');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 w-full">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4">
        <div className="flex items-center p-4">
          <Button 
            variant="ghost" 
            className="mr-2 pl-0 hover:bg-white hover:text-black" 
            onClick={() => navigate(-1)}
          >
            <X size={16} />
          </Button>
          <h1 className="text-2xl font-bold">{postId ? 'Edit Post' : 'Create a Post'}</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full">
          <div className="bg-card w-full px-4 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-medium">Title*</Label>
              <Input
                id="title"
                name="title"
                placeholder="What do you need?"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-medium">Description*</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Provide details about what you're looking for..."
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
                required
                className="w-full resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-base font-medium">Category*</Label>
              <div className="relative">
                <Input
                  type="text"
                  id="category-search"
                  placeholder={formData.category || "Search and select category..."}
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  onFocus={() => setIsSearching(true)}
                  className="w-full"
                />
                {isSearching && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                    <div className="max-h-[300px] overflow-y-auto py-1">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map(category => (
                          <div
                            key={category}
                            className={`px-3 py-2 cursor-pointer hover:bg-accent ${formData.category === category ? 'bg-accent' : ''}`}
                            onClick={() => {
                              handleSelectChange(category);
                              setCategorySearch('');
                              setIsSearching(false);
                            }}
                          >
                            {category}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No categories found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {formData.category && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div>Selected: <span className="font-medium text-foreground">{formData.category}</span></div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      handleSelectChange('');
                      setCategorySearch('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-medium">Location*</Label>
              <Input
                id="location"
                name="location"
                placeholder="Where are you located?"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="images" className="text-base font-medium">
                  Images ({formData.images.length}/{MAX_PHOTOS})
                </Label>
                <p className="text-sm text-muted-foreground">
                  {MAX_PHOTOS - formData.images.length} slots remaining
                </p>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Input
                    id="images"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={formData.images.length >= MAX_PHOTOS}
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 border rounded-lg p-2 bg-background">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={formData.images.length >= MAX_PHOTOS}
                      className="shrink-0"
                    >
                      <Images size={18} />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {formData.images.length >= MAX_PHOTOS 
                        ? 'Maximum images reached' 
                        : 'Click to choose images or drag and drop'}
                    </span>
                  </div>
                </div>
                
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={image.preview} 
                          alt={`Preview ${index + 1}`} 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button 
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <Button 
              type="submit" 
              className="bg-accent1-500 text-white font-medium py-3 px-12 rounded-lg text-lg shadow-lg w-full max-w-md hover:bg-white hover:text-black"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : postId ? 'Update Post' : 'Create Post'}
            </Button>
          </div>
        </form>

        {!post.purchased && post.posted_by.id !== user?.id && (
          <Button
            onClick={() => {
              // Show rating dialog
              const rating = prompt('Rate the seller (1-5):');
              if (rating) {
                const numRating = parseInt(rating);
                if (numRating >= 1 && numRating <= 5) {
                  const comment = prompt('Add a comment (optional):');
                  handleMarkAsPurchased(numRating, comment || undefined);
                } else {
                  toast.error('Please enter a rating between 1 and 5');
                }
              }
            }}
            className="w-full"
          >
            Mark as Purchased
          </Button>
        )}
      </div>

      <Navigation />
    </div>
  );
};

export default Post;
