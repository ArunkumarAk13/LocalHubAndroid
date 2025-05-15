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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const existingImages = formData.images.filter(img => img.isExisting);
      const newImages = [...formData.images.filter(img => !img.isExisting)];
      
      for (let i = 0; i < files.length; i++) {
        if (existingImages.length + newImages.length < MAX_PHOTOS) {
          newImages.push({
            file: files[i],
            preview: URL.createObjectURL(files[i])
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
      if (!formData.title || !formData.description || !formData.category) {
        toast.error("Please fill in all required fields");
        setIsSubmitting(false);
        return;
      }

      const postFormData = new FormData();
      postFormData.append('title', formData.title);
      postFormData.append('description', formData.description);
      postFormData.append('category', formData.category);
      
      if (formData.location) {
        postFormData.append('location', formData.location);
      }
      
      // Add existing images that should be kept
      const existingImages = formData.images.filter(img => img.isExisting);
      if (existingImages.length > 0) {
        postFormData.append('existingImages', JSON.stringify(existingImages.map(img => img.url)));
      }
      
      // Add new images
      const newImages = formData.images.filter(img => !img.isExisting);
      if (newImages.length > 0) {
        newImages.forEach(image => {
          postFormData.append('images', image.file);
        });
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
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error("Failed to save post. Please try again.");
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
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="mr-2 pl-0" 
            onClick={() => navigate(-1)}
          >
            <X size={16} />
          </Button>
          <h1 className="text-2xl font-bold">{postId ? 'Edit Post' : 'Create a Post'}</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card rounded-lg p-6 shadow-sm space-y-6">
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
              <Select 
                onValueChange={handleSelectChange}
                value={formData.category}
                onOpenChange={(open) => {
                  if (!open) {
                    // Prevent closing if we're focusing the search input
                    const activeElement = document.activeElement;
                    if (activeElement?.tagName === 'INPUT') {
                      return false;
                    }
                  }
                }}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <div className="flex items-center px-3 pb-2 sticky top-0 bg-background border-b">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      enterKeyHint="search"
                      placeholder="Search categories..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="h-8"
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onFocus={(e) => e.stopPropagation()}
                      onBlur={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No categories found
                      </div>
                    )}
                  </div>
                </SelectContent>
              </Select>
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

          <div className="flex justify-end">
            <Button 
              type="submit" 
              className="bg-accent1-500 hover:bg-accent1-600 text-white font-medium py-3 px-8 rounded-lg text-lg shadow-lg"
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
