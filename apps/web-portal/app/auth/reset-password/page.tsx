'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if (!token_hash || type !== 'recovery') {
      queueMicrotask(() => {
        setError('Invalid or missing reset token. Please request a new password reset link.');
        setVerifying(false);
      });
      return;
    }

    supabase.auth
      .verifyOtp({ token_hash, type: 'recovery' })
      .then(({ error }) => {
        if (error) {
          setError(error.message);
        }
        setVerifying(false);
      });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      toast.success('Password updated successfully!');
      router.push('/');
    }
  };

  const passwordStrength =
    password.length === 0
      ? null
      : password.length < 6
        ? 'weak'
        : password.length < 8
          ? 'fair'
          : 'strong';
  const strengthColor =
    passwordStrength === 'weak'
      ? 'bg-destructive'
      : passwordStrength === 'fair'
        ? 'bg-yellow-500'
        : 'bg-success';
  const strengthWidth =
    passwordStrength === 'weak' ? 'w-1/3' : passwordStrength === 'fair' ? 'w-2/3' : 'w-full';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary/5 to-amber-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-brand-primary p-3 rounded-full">
              <UtensilsCrossed className="h-8 w-8 text-background" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          {verifying ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error && !password ? (
            <div className="space-y-4 text-center">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-brand-primary hover:text-brand-primary/90 font-medium"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
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
                      <div
                        className={`h-full ${strengthColor} ${strengthWidth} rounded-full transition-all duration-300`}
                      />
                    </div>
                    <p
                      className={`text-xs ${passwordStrength === 'weak' ? 'text-destructive' : passwordStrength === 'fair' ? 'text-yellow-600' : 'text-success'}`}
                    >
                      {passwordStrength === 'weak'
                        ? 'Too short — at least 6 characters'
                        : passwordStrength === 'fair'
                          ? 'Fair — try 8+ characters'
                          : 'Strong password'}
                    </p>
                  </div>
                )}
                {!passwordStrength && (
                  <p className="text-xs text-muted-foreground">At least 6 characters</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
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
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
