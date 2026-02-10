import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRestaurants } from '../hooks';

/**
 * Test screen to verify Supabase connection
 * This can be used to test data fetching before integrating with the swipe interface
 */
export function SupabaseTestScreen() {
  const { restaurants, loading, error, refetch } = useRestaurants({ limit: 10 });

  useEffect(() => {
    console.log('📊 Restaurants loaded:', restaurants.length);
  }, [restaurants]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading restaurants...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>❌ Error: {error.message}</Text>
        <Text style={styles.errorHint}>Check your Supabase credentials in .env</Text>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No restaurants found</Text>
        <Text style={styles.emptyHint}>
          Make sure you have restaurants in your Supabase database
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>✅ Supabase Connected! {restaurants.length} restaurants</Text>
      <FlatList
        data={restaurants}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.restaurantName}>{item.name}</Text>
            <Text style={styles.restaurantAddress}>{item.address}</Text>
            <Text style={styles.restaurantCuisines}>{item.cuisine_types.join(', ')}</Text>
            <Text style={styles.menuCount}>
              {item.menus?.length || 0} menus •
              {item.menus?.reduce(
                (sum, menu) =>
                  sum +
                  (menu.menu_categories?.reduce(
                    (catSum, cat) => catSum + (cat.dishes?.length || 0),
                    0
                  ) || 0),
                0
              ) || 0}{' '}
              dishes
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#FF6B35',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  restaurantCuisines: {
    fontSize: 14,
    color: '#FF6B35',
    marginBottom: 4,
  },
  menuCount: {
    fontSize: 12,
    color: '#999',
  },
});
