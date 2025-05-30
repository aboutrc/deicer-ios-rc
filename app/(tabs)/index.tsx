import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Platform, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapPin, CircleAlert as AlertCircle, Loader as Loader2, Camera, Eye, Shield, Search, Plus, RotateCw, Clock, X, GraduationCap } from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import SearchLocationModal from '@/components/SearchLocationModal';
import { useMarkers } from '@/context/MarkerContext';
import UniversitiesModal from '@/components/UniversitiesModal';

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showPinTypeModal, setShowPinTypeModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [showUniversitiesModal, setShowUniversitiesModal] = useState(false);
  const [showSearchLocationModal, setShowSearchLocationModal] = useState(false);
  const mapRef = useRef<any>(null);
  const router = useRouter();
  const { t, isInitialized } = useLanguage();
  const params = useLocalSearchParams();
  const { markers, isAddingMarker, setIsAddingMarker, addMarker, loading: markersLoading, refreshMarkers } = useMarkers();

  // Refresh markers on initial load
  useEffect(() => {
    refreshMarkers();
  }, []);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshMarkers();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (params.action === 'addMark') {
      setIsAddingMarker(true);
    }
  }, [params.action]);

  const handleMapPress = (event: any) => {
    if (!isAddingMarker) return;
    
    setSelectedLocation({
      latitude: event.nativeEvent.coordinate.latitude,
      longitude: event.nativeEvent.coordinate.longitude
    });
    setShowPinTypeModal(true);
    setIsAddingMarker(false);
  };

  const handleSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error selecting image:', err);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleAddMarker = async (category: 'ice' | 'observer') => {
    if (!selectedLocation) return;

    try {
      await addMarker({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        category,
        imageUri: selectedImage
      });

      setSelectedImage(null);
      setShowPinTypeModal(false);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Error adding marker:', err);
      Alert.alert('Error', 'Failed to add marker');
    }
  };

  useEffect(() => {
    if (!isInitialized) return;

    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg(t('locationPermissionDenied') || 'Location permission denied');
          setLoading(false);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
        
        // Fetch events from API
      } catch (error) {
        setErrorMsg(t('errorFetchingLocation') || 'Error fetching location');
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [isInitialized, t]);

  const handleReportEvent = () => {
    router.push('/report');
  };

  const handleUniversitySelect = (latitude: number, longitude: number) => {
    const region: Region = {
      latitude,
      longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
    mapRef.current?.animateToRegion(region, 1000);
  };

  const renderMarkerPopup = () => {
    if (!selectedMarker) return null;

    return (
      <Modal
        visible={!!selectedMarker}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMarker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.markerPopup}>
            <View style={styles.markerPopupHeader}>
              <View style={[
                styles.categoryBadge,
                selectedMarker.category === 'ice' ? styles.iceBadge : styles.observerBadge
              ]}>
                <Text style={styles.categoryText}>
                  {selectedMarker.category.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setSelectedMarker(null)}
                style={styles.closeButton}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {selectedMarker.image_url && (
              <Image 
                source={{ uri: selectedMarker.image_url }}
                style={styles.markerImage}
                resizeMode="cover"
              />
            )}

            <View style={styles.markerInfo}>
              <Text style={styles.markerTitle}>{selectedMarker.title}</Text>
              <Text style={styles.markerDescription}>{selectedMarker.description}</Text>
              
              <View style={styles.markerMetadata}>
                <Clock size={16} color="#8E8E93" />
                <Text style={styles.metadataText}>
                  {new Date(selectedMarker.created_at).toLocaleString()}
                </Text>
              </View>

              <View style={styles.markerStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Confirmations</Text>
                  <Text style={styles.statValue}>{selectedMarker.confirmations_count}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Reliability</Text>
                  <Text style={styles.statValue}>
                    {Math.round(selectedMarker.reliability_score * 100)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMapPlaceholder}>
          <AlertCircle size={24} color="#007AFF" />
          <Text style={styles.webMapText}>{t('mapNotAvailableWeb')}</Text>
          <Text style={styles.webMapSubText}>{t('useNativePlatform')}</Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        initialRegion={location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        } : undefined}
        onPress={handleMapPress}
      >
        {selectedLocation && (
          <Marker
            coordinate={{
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude
            }}
            pinColor="#FF3B30"
          >
            <MapPin size={28} color="#007AFF" />
          </Marker>
        )}
        
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude
            }}
            onPress={() => setSelectedMarker(marker)}
          >
            <MapPin 
              size={28} 
              color={marker.category === 'ice' ? '#FF3B30' : '#007AFF'} 
            />
          </Marker>
        ))}
      </MapView>
    );
  };

  const renderPinTypeModal = () => {
    if (!showPinTypeModal) return null;

    const handleCancel = () => {
      setShowPinTypeModal(false);
      setSelectedLocation(null);
      setSelectedImage(null);
    };

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Pin</Text>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.imageButton} onPress={handleSelectImage}>
            <Camera size={24} color="#007AFF" />
            <Text style={styles.imageButtonText}>
              {selectedImage ? 'Change Photo' : 'Add Photo (Optional)'}
            </Text>
          </TouchableOpacity>

          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
          )}

          <View style={styles.pinTypeContainer}>
            <TouchableOpacity 
              style={[styles.pinTypeButton, styles.iceButton]}
              onPress={() => handleAddMarker('ice')}
            >
              <Shield size={24} color="#FFF" />
              <Text style={styles.pinTypeText}>ICE</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.pinTypeButton, styles.observerButton]}
              onPress={() => handleAddMarker('observer')}
            >
              <Eye size={24} color="#FFF" />
              <Text style={styles.pinTypeText}>Observer</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.pinTypeNote}>
            Observer markers expire after 1 hour{'\n'}
            ICE markers remain active for 24 hours
          </Text>
        </View>
      </View>
    );
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Loader2 size={24} color="#007AFF" />
        <Text style={styles.loadingText}>{t('initializing') || 'Initializing...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Loader2 size={24} color="#007AFF" />
          <Text style={styles.loadingText}>{t('loading') || 'Loading...'}</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={24} color="#FF3B30" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : (
        <>
          {renderMap()}
          <View style={styles.mapControls}>
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => setShowSearchLocationModal(true)}
            >
              <Search size={24} color="#FFFFFF" />
              <Text style={styles.mapControlText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => setShowUniversitiesModal(true)}
            >
              <GraduationCap size={24} color="#FFFFFF" />
              <Text style={styles.mapControlText}>University</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={() => setIsAddingMarker(true)}
            >
              <Plus size={24} color="#FFFFFF" />
              <Text style={styles.mapControlText}>Add Mark</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.mapControlButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <RotateCw 
                size={24} 
                color="#FFFFFF"
                style={refreshing ? styles.rotating : undefined}
              />
              <Text style={styles.mapControlText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {renderPinTypeModal()}
          {renderMarkerPopup()}
          <SearchLocationModal
            visible={showSearchLocationModal}
            onClose={() => setShowSearchLocationModal(false)}
            onSelectLocation={handleUniversitySelect}
          />
          <UniversitiesModal
            visible={showUniversitiesModal}
            onClose={() => setShowUniversitiesModal(false)}
            onSelectUniversity={handleUniversitySelect}
          />
          {isAddingMarker && (
            <View style={styles.addMarkIndicator}>
              <Text style={styles.addMarkText}>{t('tapOnMapToAddMark')}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  map: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1C1C1E',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000000',
  },
  errorText: {
    marginTop: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  addMarkIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addMarkText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    fontSize: 16,
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  webMapText: {
    marginTop: 16,
    fontFamily: 'Inter-Regular',
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
  },
  webMapSubText: {
    marginTop: 8,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPopup: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  markerPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  iceBadge: {
    backgroundColor: '#FF3B30',
  },
  observerBadge: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 8,
  },
  markerImage: {
    width: '100%',
    height: 200,
  },
  markerInfo: {
    padding: 16,
  },
  markerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  markerDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#8E8E93',
    marginBottom: 16,
  },
  markerMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metadataText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#8E8E93',
    marginLeft: 8,
  },
  markerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  modal: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    color: '#FFFFFF',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#FF3B30',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  imageButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  pinTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pinTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  iceButton: {
    backgroundColor: '#FF3B30',
  },
  observerButton: {
    backgroundColor: '#007AFF',
  },
  pinTypeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
  },
  pinTypeNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  mapControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  mapControlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
  rotating: {
    transform: [{ rotate: '360deg' }],
  },
});