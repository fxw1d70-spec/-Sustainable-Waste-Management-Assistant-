import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebase.js'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

// Firebase error codes are not user-facing; map the common ones to plain English.
function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.'
    case 'auth/missing-password':
      return 'Please enter a password.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and retry.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in the Firebase console.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in your Firebase Auth settings.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Keyless demo mode: no Firebase, so treat everyone as a guest.
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  async function signUp(email, password, displayName) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) {
        await updateProfile(cred.user, { displayName })
        setUser({ ...cred.user, displayName })
      }
      return cred.user
    } catch (err) {
      throw new Error(friendlyError(err.code))
    }
  }

  async function signIn(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      return cred.user
    } catch (err) {
      throw new Error(friendlyError(err.code))
    }
  }

  async function signInWithGoogle() {
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      return cred.user
    } catch (err) {
      throw new Error(friendlyError(err.code))
    }
  }

  async function logout() {
    if (isFirebaseConfigured) await signOut(auth)
  }

  const value = {
    user,
    loading,
    authEnabled: isFirebaseConfigured,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
