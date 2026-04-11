'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/supabase';
import { Edit, Ban, CheckCircle, MapPin, Phone, Globe } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { STATUS_VARIANTS } from '@/lib/ui-constants';

export default function RestaurantDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', restaurantId)
          .single();

        if (error) {
          console.error('[Admin] Error fetching restaurant:', error);
          toast.error('Failed to load restaurant');
          router.push('/admin/restaurants');
          return;
        }

        setRestaurant(data);
      } catch (error) {
        console.error('[Admin] Unexpected error:', error);
        toast.error('An unexpected error occurred');
        router.push('/admin/restaurants');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Loading..."
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Restaurants', href: '/admin/restaurants' },
          ]}
        />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const statusKey = restaurant.is_active ? 'active' : 'suspended';
  const statusVariant = STATUS_VARIANTS[statusKey];

  return (
    <div className="space-y-6">
      <PageHeader
        title={restaurant.name}
        description="Restaurant Details"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Restaurants', href: '/admin/restaurants' },
          { label: restaurant.name },
        ]}
        badge={{ label: statusVariant.label, variant: statusKey === 'active' ? 'success' : 'destructive' }}
        actions={
          <div className="flex gap-3">
            <Link
              href={`/admin/restaurants/${restaurant.id}/menus`}
              className="flex items-center gap-2 px-4 py-2 border border-brand-primary text-brand-primary rounded-lg hover:bg-brand-primary/5"
            >
              Manage Menus
            </Link>
            <Link
              href={`/admin/restaurants/${restaurant.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90"
            >
              <Edit className="h-5 w-5" />
              Edit Restaurant
            </Link>
          </div>
        }
      />

      {/* Status Alert */}
      {!restaurant.is_active && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Ban className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Restaurant Suspended</h3>
              {restaurant.suspension_reason && (
                <p className="text-sm text-destructive mt-1">{restaurant.suspension_reason}</p>
              )}
              {restaurant.suspended_at && (
                <p className="text-xs text-destructive mt-1">
                  Suspended on {new Date(restaurant.suspended_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Basic Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Restaurant Name</dt>
                <dd className="mt-1 text-sm text-foreground">{restaurant.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                <dd className="mt-1 text-sm text-foreground capitalize">
                  {restaurant.restaurant_type}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">Cuisine Types</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {(restaurant.cuisine_types ?? []).map(cuisine => (
                    <span
                      key={cuisine}
                      className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-sm rounded-full"
                    >
                      {cuisine}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          {/* Location */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Location</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{restaurant.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {restaurant.city}
                    {restaurant.postal_code && `, ${restaurant.postal_code}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{restaurant.country_code}</p>
                </div>
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">Coordinates</p>
                <p className="text-sm text-foreground mt-1">
                  {(restaurant.location as { lat?: number; lng?: number } | null)?.lat?.toFixed(6)},{' '}
                  {(restaurant.location as { lat?: number; lng?: number } | null)?.lng?.toFixed(6)}
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Contact Information</h2>
            <dl className="space-y-3">
              {restaurant.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="text-sm text-foreground">{restaurant.phone}</dd>
                  </div>
                </div>
              )}
              {restaurant.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Website</dt>
                    <dd className="text-sm text-foreground">
                      <a
                        href={restaurant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary hover:underline"
                      >
                        {restaurant.website}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Status</h2>
            <div className="space-y-3">
              <div className={`flex items-center gap-2 ${statusVariant.text}`}>
                {restaurant.is_active ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Ban className="h-5 w-5" />
                )}
                <span className="font-medium">{statusVariant.label}</span>
              </div>
            </div>
          </div>

          {/* Service Options */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Service Options</h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.delivery_available ? 'bg-success' : 'bg-muted-foreground/50'}`}
                />
                Delivery {restaurant.delivery_available ? 'Available' : 'Not Available'}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.takeout_available ? 'bg-success' : 'bg-muted-foreground/50'}`}
                />
                Takeout {restaurant.takeout_available ? 'Available' : 'Not Available'}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.dine_in_available ? 'bg-success' : 'bg-muted-foreground/50'}`}
                />
                Dine-in {restaurant.dine_in_available ? 'Available' : 'Not Available'}
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${restaurant.accepts_reservations ? 'bg-success' : 'bg-muted-foreground/50'}`}
                />
                Reservations {restaurant.accepts_reservations ? 'Accepted' : 'Not Accepted'}
              </li>
            </ul>
          </div>

          {/* Metadata */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Metadata</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground mt-1">
                  {restaurant.created_at ? new Date(restaurant.created_at).toLocaleString() : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Updated</dt>
                <dd className="text-foreground mt-1">
                  {restaurant.updated_at ? new Date(restaurant.updated_at).toLocaleString() : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner ID</dt>
                <dd className="text-foreground mt-1 font-mono text-xs break-all">
                  {restaurant.owner_id}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
