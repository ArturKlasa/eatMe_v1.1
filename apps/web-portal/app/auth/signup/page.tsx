'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Loader2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleIcon, FacebookIcon } from '@/components/icons/OAuthIcons';

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithOAuth } = useAuth();
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, restaurantName);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      toast.success('Account created! Please check your email to verify your account.');
      router.push('/auth/login');
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    setError('');
    setOauthLoading(true);

    try {
      const { error } = await signInWithOAuth(provider);
      if (error) {
        console.error('OAuth error:', error);
        setError(error.message);
        toast.error(`Failed to sign up with ${provider}: ${error.message}`);
        setOauthLoading(false);
      }
      // If successful, user will be redirected by Supabase
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
      toast.error('Failed to initiate sign up');
      setOauthLoading(false);
    }
  };

  const passwordStrength = password.length === 0 ? null : password.length < 6 ? 'weak' : password.length < 8 ? 'fair' : 'strong';
  const strengthColor = passwordStrength === 'weak' ? 'bg-destructive' : passwordStrength === 'fair' ? 'bg-yellow-500' : 'bg-success';
  const strengthWidth = passwordStrength === 'weak' ? 'w-1/3' : passwordStrength === 'fair' ? 'w-2/3' : 'w-full';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary/5 to-amber-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-brand-primary p-3 rounded-full">
              <UtensilsCrossed className="h-8 w-8 text-background" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Sign up to list your restaurant</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="restaurantName">Restaurant Name</Label>
              <Input
                id="restaurantName"
                type="text"
                placeholder="Your Restaurant Name"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="restaurant@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordStrength && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} ${strengthWidth} rounded-full transition-all duration-300`} />
                  </div>
                  <p className={`text-xs ${passwordStrength === 'weak' ? 'text-destructive' : passwordStrength === 'fair' ? 'text-yellow-600' : 'text-success'}`}>
                    {passwordStrength === 'weak' ? 'Too short — at least 6 characters' : passwordStrength === 'fair' ? 'Fair — try 8+ characters' : 'Strong password'}
                  </p>
                </div>
              )}
              {!passwordStrength && <p className="text-xs text-muted-foreground">At least 6 characters</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-primary/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn('google')}
                disabled={loading || oauthLoading}
                className="relative"
              >
                {oauthLoading && <Loader2 className="absolute left-3 h-4 w-4 animate-spin" />}
                <GoogleIcon className={`mr-2 h-4 w-4 ${oauthLoading ? 'invisible' : ''}`} />
                <span className={oauthLoading ? 'invisible' : ''}>Google</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={loading || oauthLoading}
                className="relative"
              >
                {oauthLoading && <Loader2 className="absolute left-3 h-4 w-4 animate-spin" />}
                <FacebookIcon className={`mr-2 h-4 w-4 ${oauthLoading ? 'invisible' : ''}`} />
                <span className={oauthLoading ? 'invisible' : ''}>Facebook</span>
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-brand-primary hover:text-brand-primary/90 font-medium"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
