import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, DollarSign, Wrench, Star, Check } from "lucide-react";
import heroImage from "@/assets/hero-dashboard.jpg";

const Index = () => {
  const [selectedRole, setSelectedRole] = useState<"landlord" | "tenant" | null>(null);

  const features = [
    {
      icon: Building2,
      title: "Property Management",
      description: "Add, edit, and manage all your rental properties in one place"
    },
    {
      icon: DollarSign,
      title: "Payment Tracking",
      description: "Monitor rent payments, send reminders, and generate reports"
    },
    {
      icon: Wrench,
      title: "Maintenance Requests",
      description: "Track and manage maintenance tasks efficiently"
    },
    {
      icon: Users,
      title: "Tenant Portal",
      description: "Give tenants easy access to payments and communication"
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "Free",
      description: "Perfect for small landlords",
      features: ["Up to 5 properties", "Basic payment tracking", "Maintenance requests", "Email support"],
      popular: false
    },
    {
      name: "Professional",
      price: "$29/month",
      description: "Best for growing portfolios",
      features: ["Unlimited properties", "Advanced reporting", "SMS notifications", "Priority support", "QuickBooks integration"],
      popular: true
    },
    {
      name: "Enterprise",
      price: "$99/month", 
      description: "For large property managers",
      features: ["Everything in Professional", "Custom branding", "API access", "Dedicated support", "Advanced analytics"],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">HomeLend</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost">Features</Button>
            <Button variant="ghost">Pricing</Button>
            <Button variant="outline">Sign In</Button>
            <Button>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">
            Simplify Your Rental Property Management
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamline tenant management, track payments, and handle maintenance requests 
            all in one powerful platform designed for modern landlords.
          </p>
          
          <div className="flex justify-center mb-12">
            <img 
              src={heroImage} 
              alt="Property Management Dashboard" 
              className="rounded-lg shadow-2xl max-w-4xl w-full"
            />
          </div>

          {/* Role Selection */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6">Choose Your Portal</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card 
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  selectedRole === "landlord" ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedRole("landlord")}
              >
                <CardHeader className="text-center">
                  <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Landlord Portal</CardTitle>
                  <CardDescription>
                    Manage properties, track payments, and communicate with tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" size="lg">
                    Access Landlord Dashboard
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  selectedRole === "tenant" ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedRole("tenant")}
              >
                <CardHeader className="text-center">
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Tenant Portal</CardTitle>
                  <CardDescription>
                    View lease details, make payments, and submit maintenance requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" size="lg" variant="outline">
                    Access Tenant Portal
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Everything You Need to Manage Rentals
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive platform provides all the tools you need to efficiently 
              manage your rental properties and keep tenants happy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <feature.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              Choose the plan that works best for your portfolio size
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? "ring-2 ring-primary" : ""}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold text-primary mb-2">{plan.price}</div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <Check className="h-4 w-4 text-success mr-2" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Streamline Your Property Management?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Join thousands of landlords who have simplified their rental business with HomeLend
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">HomeLend</span>
              </div>
              <p className="text-muted-foreground">
                Simplifying rental property management for landlords and tenants.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Features</li>
                <li>Pricing</li>
                <li>Security</li>
                <li>Integrations</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Help Center</li>
                <li>Contact Us</li>
                <li>API Docs</li>
                <li>Status</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>About Us</li>
                <li>Blog</li>
                <li>Careers</li>
                <li>Privacy</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 HomeLend. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;