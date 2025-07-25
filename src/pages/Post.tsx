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
    city: user?.city || '',
    district: user?.district || '',
    state: user?.state || '',
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
              city: post.city || '',
              district: post.district || '',
              state: post.state || '',
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
        .finally(() => setIsLoading(false));
    } else {
      // Default to user's profile city/district/state for new posts
      setFormData(prev => ({
        ...prev,
        city: user?.city || '',
        district: user?.district || '',
        state: user?.state || '',
      }));
    }
  }, [postId, navigate, user?.city, user?.district, user?.state]);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const existingImages = formData.images.filter(img => img.isExisting);
      const newImages = [...formData.images.filter(img => !img.isExisting)];
      
      for (let i = 0; i < files.length; i++) {
        if (existingImages.length + newImages.length < MAX_PHOTOS) {
          const file = files[i];
          // Ensure the file is a valid image
          if (!file.type.startsWith('image/')) {
            toast.error('Please select only image files');
            continue;
          }
          
          // Create a blob URL for preview
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
  };

  const removeImage = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.title?.trim() || !formData.description?.trim() || !formData.category?.trim()) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);
        return;
      }

      if (!formData.city || !formData.district || !formData.state) {
        toast.error("City, district, and state are required.");
        setIsSubmitting(false);
        return;
      }

      // Create FormData object
      const postFormData = new FormData();
      
      // Log the form data for debugging
      console.log('Form data before submission:', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        city: formData.city,
        district: formData.district,
        state: formData.state,
        imagesCount: formData.images.length,
        platform: Capacitor.getPlatform()
      });

      // Append text fields
      postFormData.append('title', formData.title.trim());
      postFormData.append('description', formData.description.trim());
      postFormData.append('category', formData.category.trim());
      postFormData.append('city', formData.city.trim());
      postFormData.append('district', formData.district.trim());
      postFormData.append('state', formData.state.trim());
      
      // Add existing images that should be kept
      const existingImages = formData.images.filter(img => img.isExisting && img.url);
      if (existingImages.length > 0) {
        const existingImageUrls = existingImages.map(img => img.url);
        postFormData.append('existingImages', JSON.stringify(existingImageUrls));
      }
      
      // Add new images
      const newImages = formData.images.filter(img => !img.isExisting && img.file);
      if (newImages.length > 0) {
        newImages.forEach((image, index) => {
          const fileExtension = image.file.name.split('.').pop() || 'jpg';
          const fileName = `image_${index}_${Date.now()}.${fileExtension}`;
          const file = new File([image.file], fileName, { 
            type: image.file.type || 'image/jpeg'
          });
          postFormData.append('images', file);
        });
      }

      // Log the FormData contents for debugging
      console.log('FormData contents:');
      for (let pair of postFormData.entries()) {
        console.log('FormData entry:', pair[0], pair[1]);
      }

      // Validate FormData contents
      const title = postFormData.get('title')?.toString();
      const description = postFormData.get('description')?.toString();
      const category = postFormData.get('category')?.toString();
      const city = postFormData.get('city')?.toString();
      const district = postFormData.get('district')?.toString();
      const state = postFormData.get('state')?.toString();

      console.log('FormData validation:', {
        title,
        description,
        category,
        city,
        district,
        state,
        hasImages: postFormData.getAll('images').length > 0
      });

      if (!title || !description || !category || !city || !district || !state) {
        throw new Error('Required fields are missing in FormData');
      }
      
      let response;
      if (postId) {
        response = await postsAPI.updatePost(postId, postFormData);
      } else {
        response = await postsAPI.createPost(postFormData);
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
        platform: Capacitor.getPlatform()
      });
      
      // Show more specific error message
      const errorMessage = error.response?.data?.message || error.message || "Failed to save post. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
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
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Enter city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={formData.district}
                onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                placeholder="Enter district"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                placeholder="Enter state"
              />
            </div>
            {(formData.city && formData.district && formData.state) && (
              <div className="text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 mb-2">
                Please add city, district, and state for this post.
              </div>
            )}

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
      </div>

      <Navigation />
    </div>
  );
};

export default Post;
