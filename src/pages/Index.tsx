import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import NeedCard, { NeedCardProps } from '@/components/NeedCard';
import Navigation from '@/components/Navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { postsAPI } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

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

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const backPressRef = React.useRef<number>(0);

  const filteredCategories = CATEGORIES.filter(category =>
    category.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Load posts from API
  useEffect(() => {
    const loadPosts = async () => {
      try {
        setLoading(true);
        const response = await postsAPI.getAllPosts({
          category: selectedCategory || undefined,
          search: searchQuery || undefined,
          userCity: user?.city || undefined,
          userDistrict: user?.district || undefined,
          userState: user?.state || undefined
        });
        
        if (response.success) {
          // Filter out posts created by the current user
          const filteredPosts = response.posts
            .filter((post: any) => post.posted_by.id !== user?.id)
            .map((post: any) => ({
              id: post.id,
              title: post.title,
              description: post.description,
              category: post.category,
              image: post.images && post.images.length > 0 
                ? post.images[0] 
                : 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?q=80&w=500&auto=format&fit=crop',
              postedBy: {
                id: post.posted_by.id,
                name: post.posted_by.name,
                avatar: post.posted_by.avatar,
                rating: post.posted_by.rating,
                phone_number: post.posted_by.phone_number || '',
                settings: post.posted_by.settings || { whatsappEnabled: false }
              },
              postedAt: new Date(post.created_at).toLocaleDateString(),
              city: post.city || '',
              district: post.district || '',
              state: post.state || ''
            }));
          setPosts(filteredPosts);
        } else {
          toast("Failed to load posts");
        }
      } catch (error) {
        // Improved error logging for debugging
        if (typeof error === 'object') {
          console.error("Error loading posts:", error, JSON.stringify(error), error?.message, error?.response);
        } else {
          console.error("Error loading posts:", error);
        }
        toast("Error loading posts. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [selectedCategory, searchQuery, user?.id, user?.city, user?.district, user?.state]);

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onExitApp = (e: Event) => {
      const now = Date.now();
      if (backPressRef.current && now - backPressRef.current < 2000) {
        CapacitorApp.exitApp();
      } else {
        backPressRef.current = now;
        toast("Press back again to exit");
      }
    };

    window.addEventListener('exitApp', onExitApp);
    return () => {
      window.removeEventListener('exitApp', onExitApp);
    };
  }, []);

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="w-full px-2 py-4 md:px-4 md:max-w-7xl md:mx-auto">
        <div className="sticky top-14 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  {selectedCategory || 'All Categories'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full sm:w-[200px]">
                <div className="px-3 py-2">
                  <Input
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => setSelectedCategory(null)}
                    className={!selectedCategory ? 'bg-accent' : ''}
                  >
                    All Categories
                  </DropdownMenuItem>
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <DropdownMenuItem
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={selectedCategory === category ? 'bg-accent' : ''}
                      >
                        {category}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No categories found
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {loading ? (
            <div className="col-span-full text-center py-16">
              <p className="text-muted-foreground">Loading posts...</p>
            </div>
          ) : posts.length > 0 ? (
            posts.map(post => (
              <NeedCard 
                key={post.id} 
                {...post} 
                onProfileClick={handleViewProfile} 
              />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <p className="text-muted-foreground text-lg">No posts found</p>
              <p className="text-muted-foreground mb-4">Be the first to post your need</p>
              <Button 
                onClick={() => navigate('/post')}
                className="bg-accent1-500 hover:bg-accent1-600"
              >
                Create a Post
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <Navigation />
    </div>
  );
};

export default Index;
