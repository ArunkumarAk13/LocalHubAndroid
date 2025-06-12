import React, { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Grid } from "lucide-react";
import { API_BASE_URL } from '@/api/config';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { toast } from 'sonner';
import { usersAPI } from '@/api';

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

const Navbar = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [subscribedCategories, setSubscribedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');

  const filteredCategories = CATEGORIES.filter(category =>
    category.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Update isAuthPage when location changes
  useEffect(() => {
    setIsAuthPage(location.pathname === "/login" || location.pathname === "/register");
  }, [location.pathname]);

  // Fetch subscribed categories
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setSubscribedCategories([]);
      return;
    }
    
    const fetchSubscribedCategories = async () => {
      try {
        const response = await usersAPI.getSubscribedCategories();
        if (response.success && Array.isArray(response.categories)) {
          setSubscribedCategories(response.categories);
        } else {
          setSubscribedCategories([]);
          if (isInitialLoad) {
            toast.error("Failed to load category subscriptions");
          }
        }
        setIsInitialLoad(false);
      } catch (error) {
        console.error("Error fetching subscribed categories:", error);
        setSubscribedCategories([]);
        if (isInitialLoad) {
          toast.error("Failed to load category subscriptions");
        }
      }
    };

    fetchSubscribedCategories();
  }, [isAuthenticated, user, isInitialLoad]);

  const toggleCategorySubscription = async (category: string) => {
    if (!isAuthenticated || !user) {
      toast.error("You must be logged in to subscribe to categories");
      return;
    }
    
    setLoading(true);
    try {
      if (subscribedCategories.includes(category)) {
        // Unsubscribe from category
        const response = await usersAPI.unsubscribeFromCategory(category);
        if (response.success) {
          setSubscribedCategories(prev => prev.filter(c => c !== category));
          toast.success(`Unsubscribed from ${category} notifications`);
        } else {
          toast.error(response.message || `Failed to unsubscribe from ${category}`);
        }
      } else {
        // Subscribe to category
        const response = await usersAPI.subscribeToCategory(category);
        if (response.success) {
          setSubscribedCategories(prev => [...prev, category]);
          toast.success(`Subscribed to ${category} notifications`);
        } else {
          // If we get "already subscribed" error, update our local state to match reality
          if (response.message && response.message.includes("Already subscribed")) {
            setSubscribedCategories(prev => 
              prev.includes(category) ? prev : [...prev, category]
            );
          }
          toast.error(response.message || `Failed to subscribe to ${category}`);
        }
      }
    } catch (error: any) {
      console.error(`Error toggling subscription for ${category}:`, error);
      const errorMessage = error.response?.data?.message || `Failed to update subscription for ${category}`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthPage) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo.jpg" alt="LocalHub Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-xl">Local Hub</span>
          </Link>
        </div>
        {isAuthenticated && (
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nav-icon relative" disabled={loading || isInitialLoad}>
                  <Grid size={24} />
                  {subscribedCategories.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-accent1-500 text-white text-xs flex items-center justify-center rounded-full">
                      {subscribedCategories.length}
                    </span>
                  )}
                  {isInitialLoad && (
                    <span className="absolute top-0 right-0 h-3 w-3 bg-yellow-500 rounded-full animate-pulse"></span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px]">
                <div className="px-3 py-2 font-semibold border-b">
                  Category Subscriptions {isInitialLoad && "(loading...)"}
                  {subscribedCategories.length > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({subscribedCategories.length} subscribed)
                    </span>
                  )}
                </div>
                <div className="flex items-center px-3 py-2 sticky top-0 bg-background border-b">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <DropdownMenuCheckboxItem
                        key={category}
                        checked={subscribedCategories.includes(category)}
                        onCheckedChange={() => toggleCategorySubscription(category)}
                        disabled={loading || isInitialLoad}
                      >
                        {category}
                        {loading && subscribedCategories.includes(category) ? " (updating...)" : ""}
                      </DropdownMenuCheckboxItem>
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
        )}
      </div>
    </nav>
  );
};

export default Navbar; 