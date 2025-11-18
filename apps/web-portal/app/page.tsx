'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Utensils,
  Settings,
  FileText,
  Download,
  ChefHat,
  Clock,
  MapPin,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useMemo } from 'react';
import { loadRestaurantData } from '@/lib/storage';
import { FormProgress } from '@/types/restaurant';

export default function Home() {
  // Load data directly without useState to avoid cascading renders
  const savedData = useMemo<FormProgress | null>(() => {
    if (typeof window !== 'undefined') {
      return loadRestaurantData();
    }
    return null;
  }, []);

  const navigationItems = [
    {
      title: 'Restaurant Information',
      description: 'Add or update your restaurant details, location, and contact info',
      icon: MapPin,
      href: '/onboard/basic-info',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      status: savedData?.basicInfo ? 'completed' : 'not-started',
    },
    {
      title: 'Operating Hours',
      description: 'Set your opening hours, service options, and preparation times',
      icon: Clock,
      href: '/onboard/operations',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      status: savedData?.operations ? 'completed' : 'not-started',
    },
    {
      title: 'Menu Management',
      description: 'Add, edit, and organize your menu items with prices and descriptions',
      icon: Utensils,
      href: '/onboard/menu',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      status: savedData?.dishes && savedData.dishes.length > 0 ? 'completed' : 'not-started',
      badge:
        savedData?.dishes && savedData.dishes.length > 0
          ? `${savedData.dishes.length} dishes`
          : null,
    },
    {
      title: 'Review & Export',
      description: 'Preview your complete profile and export data for submission',
      icon: FileText,
      href: '/onboard/review',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      status: 'available',
    },
  ];

  const quickActions = [
    {
      title: 'Download Template',
      description: 'Get CSV template for bulk menu import',
      icon: Download,
      action: 'download-template',
    },
    {
      title: 'Settings',
      description: 'Configure portal preferences',
      icon: Settings,
      action: 'settings',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 rounded-lg p-2">
                <ChefHat className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Restaurant Partner Portal</h1>
                <p className="text-sm text-gray-600">Manage your EatMe presence</p>
              </div>
            </div>
            {savedData?.lastSaved && (
              <Badge variant="secondary">
                Last saved: {new Date(savedData.lastSaved).toLocaleString()}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome! 👋</h2>
          <p className="text-gray-600">
            Complete your restaurant profile to start reaching hungry customers. Select a section
            below to get started.
          </p>
        </div>

        {/* Progress Overview */}
        {savedData && (
          <Card className="mb-8 bg-linear-to-r from-orange-50 to-red-50 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-orange-500" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {savedData.basicInfo ? '✓' : '○'}
                  </div>
                  <p className="text-sm text-gray-600">Basic Info</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {savedData.operations ? '✓' : '○'}
                  </div>
                  <p className="text-sm text-gray-600">Operations</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {savedData.dishes?.length || 0}
                  </div>
                  <p className="text-sm text-gray-600">Menu Items</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {savedData.currentStep || 0}/4
                  </div>
                  <p className="text-sm text-gray-600">Steps Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Navigation */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Manage Your Restaurant</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {navigationItems.map(item => (
              <Link key={item.title} href={item.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`${item.bgColor} p-3 rounded-lg`}>
                          <item.icon className={`h-6 w-6 ${item.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          {item.badge && (
                            <Badge variant="secondary" className="mt-1">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{item.description}</CardDescription>
                    {item.status === 'completed' && (
                      <div className="flex items-center gap-1 text-green-600 text-sm mt-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {quickActions.map(action => (
              <Card key={action.title} className="hover:bg-gray-50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <action.icon className="h-5 w-5 text-gray-600" />
                    <div>
                      <CardTitle className="text-base">{action.title}</CardTitle>
                      <CardDescription className="text-sm">{action.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <Card className="mt-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-2">
              Have questions about setting up your restaurant profile?
            </p>
            <a
              href="mailto:partners@eatme.app"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Contact Support →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
