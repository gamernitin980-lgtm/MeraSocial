import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, testFirestoreConnection } from './lib/firebase';
import {
  saveUserProfileToFirestore,
  getUserProfileFromFirestore,
  getAllUsersFromFirestore,
  savePostToFirestore,
  deletePostFromFirestore,
  subscribeToPosts,
  toggleLikeInFirestore,
  toggleSaveInFirestore,
  addCommentToFirestore,
  saveStoryToFirestore,
  subscribeToStories,
  markStoryViewedInFirestore,
  toggleFollowInFirestore,
  subscribeToNotifications,
  markNotificationsAsReadInFirestore,
  seedInitialDataIfEmpty,
} from './lib/firestoreService';
import {
  TabType,
  Post,
  Story,
  User,
  NotificationItem,
} from './types';
import {
  INITIAL_POSTS,
  INITIAL_STORIES,
  SAMPLE_USERS,
  CURRENT_USER,
  INITIAL_NOTIFICATIONS,
} from './data/mockData';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { StoriesBar } from './components/StoriesBar';
import { StoryViewerModal } from './components/StoryViewerModal';
import { PostCard } from './components/PostCard';
import { CommentModal } from './components/CommentModal';
import { CreatePostModal } from './components/CreatePostModal';
import { CreateStoryModal } from './components/CreateStoryModal';
import { ProfileView } from './components/ProfileView';
import { ExploreView } from './components/ExploreView';
import { ActivityView } from './components/ActivityView';
import { DirectMessagesModal } from './components/DirectMessagesModal';
import { PostDetailModal } from './components/PostDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { Toast, ToastMessage } from './components/Toast';
import { getAvatarUrl } from './utils/avatarUtils';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('merasocial_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  // Mobile frame vs full responsive width toggle
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Feed filter: For You vs Following
  const [feedMode, setFeedMode] = useState<'for_you' | 'following'>('for_you');

  // Firebase Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Core Data States
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('merasocial_current_user');
    return saved ? JSON.parse(saved) : CURRENT_USER;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('merasocial_users');
    return saved ? JSON.parse(saved) : SAMPLE_USERS;
  });

  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('merasocial_posts');
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  });

  const [stories, setStories] = useState<Story[]>(() => {
    const saved = localStorage.getItem('merasocial_stories');
    return saved ? JSON.parse(saved) : INITIAL_STORIES;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('merasocial_notifications');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  // Active profile being viewed (null = current user's profile)
  const [viewedProfileUser, setViewedProfileUser] = useState<User | null>(null);

  // Story Viewer Modal
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  // Modals
  const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCreateStoryModalOpen, setIsCreateStoryModalOpen] = useState<boolean>(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState<boolean>(false);
  const [detailPost, setDetailPost] = useState<Post | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ id: `t_${Date.now()}`, text, type });
  };

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('merasocial_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Initial Boot: Test Firestore connection & Seed sample posts if empty
  useEffect(() => {
    testFirestoreConnection();
    seedInitialDataIfEmpty().catch(console.error);
    getAllUsersFromFirestore().then((loadedUsers) => {
      if (loadedUsers && loadedUsers.length > 0) {
        setUsers(loadedUsers);
      }
    });
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setIsAuthenticated(true);
        const profile = await getUserProfileFromFirestore(fbUser.uid);
        if (profile) {
          setCurrentUser(profile);
          localStorage.setItem('merasocial_current_user', JSON.stringify(profile));
        } else {
          const newProfile: User = {
            id: fbUser.uid,
            email: fbUser.email || '',
            username: fbUser.displayName
              ? fbUser.displayName.toLowerCase().replace(/\s+/g, '_')
              : fbUser.email?.split('@')[0] || 'user',
            fullName: fbUser.displayName || fbUser.email?.split('@')[0] || 'MeraSocial Member',
            avatar: fbUser.photoURL || getAvatarUrl(fbUser.displayName || 'User'),
            bio: 'Hey there! Exploring MeraSocial ✨',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            isVerified: false,
            isPrivate: false,
            following: [],
            createdAt: new Date().toISOString(),
          };
          setCurrentUser(newProfile);
          await saveUserProfileToFirestore(newProfile).catch(console.error);
        }
      } else {
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore subscription to posts
  useEffect(() => {
    const unsubscribe = subscribeToPosts(currentUser.id, (loadedPosts) => {
      if (loadedPosts && loadedPosts.length > 0) {
        setPosts(loadedPosts);
        localStorage.setItem('merasocial_posts', JSON.stringify(loadedPosts));
      }
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  // Real-time Firestore subscription to 24-hour stories
  useEffect(() => {
    const unsubscribe = subscribeToStories(currentUser.id, (loadedStories) => {
      if (loadedStories && loadedStories.length > 0) {
        setStories(loadedStories);
        localStorage.setItem('merasocial_stories', JSON.stringify(loadedStories));
      }
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  // Real-time Firestore subscription to notifications
  useEffect(() => {
    if (!currentUser.id) return;
    const unsubscribe = subscribeToNotifications(currentUser.id, (loadedNotifs) => {
      if (loadedNotifs && loadedNotifs.length > 0) {
        setNotifications(loadedNotifs);
      }
    });

    return () => unsubscribe();
  }, [currentUser.id]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setCurrentUser(CURRENT_USER);
      localStorage.setItem('merasocial_current_user', JSON.stringify(CURRENT_USER));
      showToast('Logged out. Switched to demo profile ✨', 'info');
    } catch (err: any) {
      showToast('Logout failed: ' + err.message, 'error');
    }
  };

  // Reset to initial demo posts and users
  const handleResetToDemo = () => {
    localStorage.removeItem('merasocial_posts');
    localStorage.removeItem('merasocial_current_user');
    localStorage.removeItem('merasocial_stories');
    localStorage.removeItem('merasocial_users');
    setPosts(INITIAL_POSTS);
    setCurrentUser(CURRENT_USER);
    setStories(INITIAL_STORIES);
    setUsers(SAMPLE_USERS);
    showToast('Restored previous demo posts & users! ✨', 'success');
  };

  // Like Toggle (Firestore + Local State + Notification)
  const handleToggleLike = async (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const willLike = !targetPost.isLiked;

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: willLike,
            likesCount: willLike ? post.likesCount + 1 : Math.max(0, post.likesCount - 1),
          };
        }
        return post;
      })
    );

    if (detailPost && detailPost.id === postId) {
      setDetailPost((prev) =>
        prev
          ? {
              ...prev,
              isLiked: willLike,
              likesCount: willLike ? prev.likesCount + 1 : Math.max(0, prev.likesCount - 1),
            }
          : null
      );
    }

    try {
      await toggleLikeInFirestore(postId, currentUser.id, !willLike, targetPost, currentUser);
    } catch (err) {
      console.warn('Liked locally:', err);
    }
  };

  // Save / Bookmark Toggle
  const handleToggleSave = async (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const willSave = !targetPost.isSaved;
    showToast(willSave ? 'Saved to your collection' : 'Removed from saved');

    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, isSaved: willSave } : post))
    );

    if (detailPost && detailPost.id === postId) {
      setDetailPost((prev) => (prev ? { ...prev, isSaved: willSave } : null));
    }

    try {
      await toggleSaveInFirestore(postId, currentUser.id, !willSave);
    } catch (err) {
      console.warn('Saved locally:', err);
    }
  };

  // Add Comment (Firestore + Local State + Notification)
  const handleAddComment = async (postId: string, text: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    const newComment = {
      id: `c_${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      userAvatar: currentUser.avatar,
      text,
      createdAt: 'Just now',
      likesCount: 0,
      isLiked: false,
    };

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, newComment],
          };
        }
        return post;
      })
    );

    if (activeCommentPost && activeCommentPost.id === postId) {
      setActiveCommentPost((prev) =>
        prev ? { ...prev, comments: [...prev.comments, newComment] } : null
      );
    }

    if (detailPost && detailPost.id === postId) {
      setDetailPost((prev) =>
        prev ? { ...prev, comments: [...prev.comments, newComment] } : null
      );
    }

    showToast('Comment posted!');

    try {
      await addCommentToFirestore(postId, newComment, targetPost, currentUser);
    } catch (err) {
      console.warn('Comment saved locally:', err);
    }
  };

  // Delete Own Post
  const handleDeletePost = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setCurrentUser((prev) => ({
      ...prev,
      postsCount: Math.max(0, prev.postsCount - 1),
    }));
    if (detailPost && detailPost.id === postId) {
      setDetailPost(null);
    }
    showToast('Post deleted', 'info');

    try {
      await deletePostFromFirestore(postId, currentUser.id);
    } catch (err) {
      console.warn('Post deleted locally:', err);
    }
  };

  // Follow / Unfollow Toggle (with Firestore sync & notification)
  const handleToggleFollow = async (userId: string) => {
    const isCurrentlyFollowing = currentUser.following?.includes(userId) ?? false;
    const willFollow = !isCurrentlyFollowing;

    // Update currentUser following list
    const updatedFollowing = willFollow
      ? [...(currentUser.following || []), userId]
      : (currentUser.following || []).filter((id) => id !== userId);

    const updatedCurrentUser = {
      ...currentUser,
      following: updatedFollowing,
      followingCount: willFollow ? currentUser.followingCount + 1 : Math.max(0, currentUser.followingCount - 1),
    };

    setCurrentUser(updatedCurrentUser);
    localStorage.setItem('merasocial_current_user', JSON.stringify(updatedCurrentUser));

    // Update target user
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            isFollowing: willFollow,
            followersCount: willFollow ? u.followersCount + 1 : Math.max(0, u.followersCount - 1),
          };
        }
        return u;
      })
    );

    if (viewedProfileUser && viewedProfileUser.id === userId) {
      setViewedProfileUser((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: willFollow,
              followersCount: willFollow ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1),
            }
          : null
      );
    }

    showToast(willFollow ? 'Following creator' : 'Unfollowed', 'info');

    try {
      await toggleFollowInFirestore(currentUser.id, userId, willFollow, currentUser);
    } catch (e) {
      console.warn('Follow saved locally:', e);
    }
  };

  // Update Profile
  const handleUpdateProfile = async (updatedData: Partial<User>) => {
    const updatedUser = {
      ...currentUser,
      ...updatedData,
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('merasocial_current_user', JSON.stringify(updatedUser));

    try {
      await saveUserProfileToFirestore(updatedUser);
      showToast('Profile saved to Firestore!');
    } catch (err) {
      showToast('Profile updated locally', 'info');
    }
  };

  // Post Created
  const handlePostCreated = async (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    setCurrentUser((prev) => ({
      ...prev,
      postsCount: prev.postsCount + 1,
    }));
    setActiveTab('home');
    showToast('Post shared to feed & saved to Firestore! ✨');

    try {
      await savePostToFirestore(newPost);
    } catch (err) {
      console.warn('Post saved locally:', err);
    }
  };

  // Story Created
  const handleStoryCreated = async (newStory: Story) => {
    setStories((prev) => [newStory, ...prev]);
    showToast('Story shared (expires in 24 hours)! ✨');

    try {
      await saveStoryToFirestore(newStory);
    } catch (err) {
      console.warn('Story saved locally:', err);
    }
  };

  // Story Viewed
  const handleStoryViewed = (storyId: string) => {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, isViewed: true } : s))
    );
    markStoryViewedInFirestore(storyId, currentUser.id);
  };

  // Story Reply
  const handleSendStoryReply = (story: Story, message: string) => {
    showToast(`Reply sent to ${story.user.username}: "${message}"`);
  };

  // Share Post Action
  const handleSharePost = (post: Post) => {
    if (navigator.share) {
      navigator
        .share({
          title: `Post by @${post.user.username} on MeraSocial`,
          text: post.caption,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Post link copied to clipboard!');
    }
  };

  // Share Profile Action
  const handleShareProfile = (user: User) => {
    navigator.clipboard?.writeText(`${window.location.origin}/@${user.username}`);
    showToast(`Profile link for @${user.username} copied!`);
  };

  // Mark all notifications read
  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    markNotificationsAsReadInFirestore(currentUser.id);
    showToast('All notifications marked as read');
  };

  // View specific user profile
  const handleViewUserProfile = (user: User) => {
    setViewedProfileUser(user);
    setActiveTab('profile');
  };

  // Tag clicked in caption
  const handleTagClick = (tag: string) => {
    setActiveTab('search');
    showToast(`Exploring #${tag}`);
  };

  // Filter posts based on Home feed mode
  const displayedPosts = posts.filter((post) => {
    if (feedMode === 'following') {
      return (
        (currentUser.following && currentUser.following.includes(post.userId)) ||
        post.userId === currentUser.id
      );
    }
    return true;
  });

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const savedPosts = posts.filter((p) => p.isSaved);

  return (
    <div className={`min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-start ${isPhoneFrame ? 'py-4 sm:py-8' : ''}`}>
      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Main Responsive Canvas or Mobile Mockup Frame */}
      <div
        className={`w-full bg-white dark:bg-neutral-900 transition-all duration-300 relative ${
          isPhoneFrame
            ? 'max-w-[420px] rounded-3xl shadow-2xl border-4 border-neutral-800 dark:border-neutral-700 overflow-hidden min-h-[850px]'
            : 'max-w-md min-h-screen sm:border-x sm:border-neutral-200 sm:dark:border-neutral-800 shadow-sm'
        }`}
      >
        {/* Top App Bar */}
        <Navbar
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          isPhoneFrame={isPhoneFrame}
          onTogglePhoneFrame={() => setIsPhoneFrame(!isPhoneFrame)}
          onOpenMessages={() => setIsMessagesOpen(true)}
          unreadCount={2}
          isAuthenticated={isAuthenticated}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogoClick={() => {
            setViewedProfileUser(null);
            setActiveTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* Tab Content */}
        <main className="w-full min-h-[calc(100vh-112px)]">
          {/* TAB 1: HOME FEED */}
          {activeTab === 'home' && (
            <div className="w-full pb-20">
              {/* Stories Bar with + button for 24h stories */}
              <StoriesBar
                stories={stories}
                currentUser={currentUser}
                onSelectStory={(index) => setActiveStoryIndex(index)}
                onAddStory={() => setIsCreateStoryModalOpen(true)}
              />

              {/* Feed Filter: For You vs Following */}
              <div className="flex items-center justify-center gap-2 py-2 px-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button
                  onClick={() => setFeedMode('for_you')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    feedMode === 'for_you'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  For You
                </button>
                <button
                  onClick={() => setFeedMode('following')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    feedMode === 'following'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Following ({currentUser.following?.length || 0})
                </button>
              </div>

              {/* Feed Posts */}
              {displayedPosts.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center p-6">
                  <span className="text-3xl mb-2">👥</span>
                  <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    No posts from accounts you follow
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mt-1 mb-4">
                    Follow photographers and creators to see their photos and videos here!
                  </p>
                  <button
                    onClick={() => setFeedMode('for_you')}
                    className="px-4 py-2 rounded-full bg-rose-500 text-white text-xs font-semibold shadow-xs"
                  >
                    Explore Discover Feed
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {displayedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onToggleLike={handleToggleLike}
                      onToggleSave={handleToggleSave}
                      onOpenComments={(p) => setActiveCommentPost(p)}
                      onAddComment={handleAddComment}
                      onDeletePost={handleDeletePost}
                      onViewUserProfile={handleViewUserProfile}
                      onTagClick={handleTagClick}
                      onSharePost={handleSharePost}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEARCH / EXPLORE */}
          {activeTab === 'search' && (
            <ExploreView
              posts={posts}
              users={users}
              currentUser={currentUser}
              onSelectPost={(post) => setDetailPost(post)}
              onSelectUser={handleViewUserProfile}
              onToggleFollow={handleToggleFollow}
            />
          )}

          {/* TAB 3: CREATE POST SCREEN */}
          {activeTab === 'create' && (
            <div className="p-4 flex flex-col items-center justify-center min-h-[500px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-lg mb-4">
                <span className="text-2xl">📸</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Create a New Post
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mt-1 mb-5">
                Share photos and videos with visual filters, write captions with hashtags, add locations, and save permanently to Firebase.
              </p>
              <div className="flex flex-col gap-2.5 w-full max-w-xs">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-md active:scale-95 transition"
                >
                  Share Photo or Video
                </button>
                <button
                  onClick={() => setIsCreateStoryModalOpen(true)}
                  className="w-full py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition"
                >
                  Add to Story (24h)
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY / NOTIFICATIONS */}
          {activeTab === 'activity' && (
            <ActivityView
              notifications={notifications}
              currentUser={currentUser}
              onToggleFollow={handleToggleFollow}
              onSelectUser={handleViewUserProfile}
              onSelectPostByImage={(imgUrl) => {
                const target = posts.find((p) => p.images[0] === imgUrl);
                if (target) setDetailPost(target);
              }}
              onMarkAllAsRead={handleMarkAllRead}
            />
          )}

          {/* TAB 5: USER PROFILE */}
          {activeTab === 'profile' && (
            <ProfileView
              user={viewedProfileUser || currentUser}
              currentUser={currentUser}
              posts={posts}
              savedPosts={savedPosts}
              onToggleFollow={handleToggleFollow}
              onUpdateProfile={handleUpdateProfile}
              onSelectPost={(post) => setDetailPost(post)}
              onShareProfile={handleShareProfile}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              isAuthenticated={isAuthenticated}
              onLogout={handleLogout}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onResetDemo={handleResetToDemo}
            />
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => {
            if (tab === 'profile') {
              setViewedProfileUser(null);
            }
            if (tab === 'create') {
              setIsCreateModalOpen(true);
              return;
            }
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          currentUser={currentUser}
          hasUnreadNotifications={unreadNotifCount > 0}
        />

        {/* 24-Hour Story Viewer Modal */}
        {activeStoryIndex !== null && (
          <StoryViewerModal
            stories={stories}
            initialIndex={activeStoryIndex}
            isOpen={activeStoryIndex !== null}
            onClose={() => setActiveStoryIndex(null)}
            onStoryViewed={handleStoryViewed}
            onSendReply={handleSendStoryReply}
          />
        )}

        {/* Comment Sheet / Drawer Modal */}
        <CommentModal
          post={activeCommentPost}
          currentUser={currentUser}
          isOpen={activeCommentPost !== null}
          onClose={() => setActiveCommentPost(null)}
          onAddComment={handleAddComment}
        />

        {/* Create Post Studio Modal */}
        <CreatePostModal
          currentUser={currentUser}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onPostCreated={handlePostCreated}
        />

        {/* Create 24h Story Modal */}
        <CreateStoryModal
          currentUser={currentUser}
          isOpen={isCreateStoryModalOpen}
          onClose={() => setIsCreateStoryModalOpen(false)}
          onStoryCreated={handleStoryCreated}
        />

        {/* Direct Messages Drawer Modal */}
        <DirectMessagesModal
          isOpen={isMessagesOpen}
          onClose={() => setIsMessagesOpen(false)}
          users={users}
          currentUser={currentUser}
        />

        {/* Post Detail Modal */}
        <PostDetailModal
          post={detailPost}
          currentUser={currentUser}
          isOpen={detailPost !== null}
          onClose={() => setDetailPost(null)}
          onToggleLike={handleToggleLike}
          onToggleSave={handleToggleSave}
          onOpenComments={(p) => setActiveCommentPost(p)}
          onAddComment={handleAddComment}
          onDeletePost={handleDeletePost}
          onViewUserProfile={handleViewUserProfile}
          onTagClick={handleTagClick}
          onSharePost={handleSharePost}
        />

        {/* Settings & Privacy Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          currentUser={currentUser}
          onUpdateProfile={handleUpdateProfile}
          onLogout={handleLogout}
          onShowToast={showToast}
        />

        {/* Firebase Authentication Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(authedUser) => {
            setCurrentUser(authedUser);
            setIsAuthenticated(true);
            showToast(`Welcome, ${authedUser.fullName}! 🎉`);
          }}
        />
      </div>
    </div>
  );
}
