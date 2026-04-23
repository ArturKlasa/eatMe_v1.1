import { notFound } from 'next/navigation';
import Link from 'next/link';
import { verifySession, getMenusWithCategoriesAndDishes } from '@/lib/auth/dal';
import { MenuManager } from '@/components/menu/MenuManager';

interface MenuPageProps {
  params: Promise<{ id: string }>;
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { id } = await params;
  const { userId } = await verifySession();

  const menus = await getMenusWithCategoriesAndDishes(id, userId);
  if (menus === null) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/restaurant/${id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to restaurant
          </Link>
          <h1 className="text-2xl font-bold mt-1">Menu management</h1>
        </div>
      </div>

      <MenuManager restaurantId={id} menus={menus} />
    </div>
  );
}
