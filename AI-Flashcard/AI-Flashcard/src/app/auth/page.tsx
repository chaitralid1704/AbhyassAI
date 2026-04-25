"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import {
  useCreateUserWithEmailAndPassword,
  useSignInWithEmailAndPassword,
} from "react-firebase-hooks/auth";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/app/firebase/config";
import { saveUserToFirestore } from "@/app/firebase/saveUser";
import { useRouter } from "next/navigation";
import { FaGoogle, FaPhone, FaEnvelope, FaLock, FaUserGraduate, FaUserFriends, FaMapSigns } from "react-icons/fa";
import { ModernButton, ModernInput } from "../components/ModernUI";
import toast from "react-hot-toast";

const provider = new GoogleAuthProvider();

export default function AuthPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isPhoneMode, setIsPhoneMode] = useState(false);
  const [role, setRole] = useState("student");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  const [otpLoading, setOtpLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const recaptchaRef = useRef<any>(null);

  const [
    createUserWithEmailAndPassword,
    createdUser,
    isCreatingUser,
    signUpError,
  ] = useCreateUserWithEmailAndPassword(auth);

  const [
    signInWithEmailAndPassword,
    signedInUser,
    isSigningIn,
    signInError,
  ] = useSignInWithEmailAndPassword(auth);

  const router = useRouter();
  const loading = isCreatingUser || isSigningIn;

  // 🔐 VALIDATION
  const isValidEmail = (email: string) =>
    /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);

  const isStrongPassword = (password: string) =>
    password.length >= 6;

  // 🔥 ERROR HANDLING
  useEffect(() => {
    if (signInError) setFormError("Login failed: " + (signInError.code || "Check credentials"));
    if (signUpError) setFormError("Signup failed: " + (signUpError.code || "Try again"));
  }, [signInError, signUpError]);

  // 🔐 SAVE USER
  useEffect(() => {
    const user = signedInUser?.user || createdUser?.user;
    if (user) {
      const finalizeAuth = async () => {
        await saveUserToFirestore(user, role, username, age);
        router.push("/dashboard"); 
      };
      finalizeAuth();
    }
  }, [signedInUser, createdUser, router, role, username, age]);

  // 📧 EMAIL/USERNAME LOGIN & SIGNUP
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isLoginMode) {
      let loginEmail = email;
      if (!email.includes("@")) {
         try {
            const res = await fetch(`http://127.0.0.1:8000/api/get-email-by-username?username=${email}`);
            if (!res.ok) throw new Error("Username not found");
            const data = await res.json();
            loginEmail = data.email;
         } catch (err) {
            setFormError("Could not find an account with that username.");
            return;
         }
      }
      
      await signInWithEmailAndPassword(loginEmail, password);
    } else {
      if (!isValidEmail(email)) {
        setFormError("Only Gmail accounts are currently supported 🚀");
        return;
      }
      if (!isStrongPassword(password)) {
        setFormError("Password must be at least 6 characters");
        return;
      }
      if (!username || !age) {
        setFormError("Username and Age are required");
        return;
      }
      try {
         const res = await fetch(`http://127.0.0.1:8000/api/check-username?username=${username}`);
         const data = await res.json();
         if (data.exists) {
            setFormError("Username is already taken!");
            return;
         }
      } catch (err) {
         setFormError("Error checking username availability.");
         return;
      }
      await createUserWithEmailAndPassword(email, password);
    }
  };

  // 🌐 GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    try {
      setGoogleLoading(true);
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user, role, null, null);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Google login error:", error);
      setFormError("Google login failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // 🔐 RECAPTCHA
  const setupRecaptcha = () => {
    if (!recaptchaRef.current && typeof window !== "undefined") {
      recaptchaRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  };

  // 📲 SEND OTP
  const handleSendOtp = async () => {
    if (otpLoading) return;
    try {
      setOtpLoading(true);
      setFormError(null);

      let formattedPhone = phone;
      if (!phone.startsWith("+91")) {
        if (phone.length === 10) {
          formattedPhone = "+91" + phone;
        } else {
          setFormError("Please enter a valid 10-digit phone number");
          return;
        }
      }

      setupRecaptcha();

      const result = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        recaptchaRef.current
      );

      setConfirmationResult(result);
      setIsOtpSent(true);
      toast.success("OTP verification code sent!");
      setFormError(null);
    } catch (error: any) {
      console.error(error);
      setFormError("Failed to send OTP. Check your connection.");
    } finally {
      setOtpLoading(false);
    }
  };

  // 🔐 VERIFY OTP
  const handleVerifyOtp = async () => {
    try {
      const result = await confirmationResult.confirm(otp);
      await saveUserToFirestore(result.user, role, null, null);
      router.push("/dashboard");
    } catch {
      setFormError("Invalid verification code. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* LEFT COLUMN: Visual Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-brand-600 relative overflow-hidden flex-col items-center justify-center p-12 text-white">
          {/* Decorative Blooms */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-accent-500/30 rounded-full blur-3xl" />
          
          <div className="relative z-10 text-center max-w-lg">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl mx-auto flex items-center justify-center text-4xl mb-8 shadow-2xl">
               <FaMapSigns className="text-white" />
            </div>
            <h1 className="text-5xl font-display font-black leading-tight mb-6">
                Start your journey with ABHYAS AI.
            </h1>
            <p className="text-brand-100 text-lg font-medium leading-relaxed">
                Whether you're a curious student eager to learn with AI flashcards, or a dedicated parent monitoring your child's progress, we've got you covered.
            </p>
          </div>

          <div className="absolute bottom-8 left-0 right-0 text-center text-brand-200/50 text-sm font-bold tracking-widest uppercase">
              Abhyas Education Protocol 2026
          </div>
      </div>

      {/* RIGHT COLUMN: The Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800">
              
              <div className="text-center mb-6">
                  <h2 className="text-3xl font-display font-extrabold text-slate-900 dark:text-white leading-tight">
                      {isPhoneMode ? "Phone Verification" : isLoginMode ? "Welcome Back" : "Create Account"}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                      {isPhoneMode 
                          ? "Verify your number to continue" 
                          : isLoginMode 
                              ? "Enter credentials to access your dashboard" 
                              : "Fill in the details below to join us"}
                  </p>
              </div>

              {formError && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/30 flex items-center gap-3 animate-in slide-in-from-top-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{formError}</p>
                  </div>
              )}

              {/* Compressed Role Selection Section ONLY during Signup */}
              {!isLoginMode && !isPhoneMode && (
                  <div className="mb-6 space-y-2">
                      <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Who are you?*</span>
                      <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => { console.log("Role set to student"); setRole("student"); }}
                            className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all cursor-pointer ${role === "student" ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400" : "border-slate-100 dark:border-slate-800 bg-transparent text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"}`}
                          >
                              <FaUserGraduate className="text-2xl mb-1" />
                              <span className="font-bold text-sm">Student</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { console.log("Role set to parent"); setRole("parent"); }}
                            className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all cursor-pointer ${role === "parent" ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400" : "border-slate-100 dark:border-slate-800 bg-transparent text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"}`}
                          >
                              <FaUserFriends className="text-2xl mb-1" />
                              <span className="font-bold text-sm">Parent</span>
                          </button>
                      </div>
                  </div>
              )}

              {isPhoneMode ? (
                  <div className="space-y-4">
                      <ModernInput
                          placeholder="e.g. 9876543210"
                          label="Phone Number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          icon={<FaPhone />}
                          disabled={isOtpSent}
                      />

                      {!isOtpSent ? (
                          <ModernButton 
                              onClick={handleSendOtp} 
                              className="w-full"
                              loading={otpLoading}
                          >
                              Send Verification Code
                          </ModernButton>
                      ) : (
                          <>
                              <ModernInput
                                  placeholder="6-digit code"
                                  label="Verification Code"
                                  value={otp}
                                  onChange={(e) => setOtp(e.target.value)}
                                  icon={<FaLock />}
                              />
                              <ModernButton onClick={handleVerifyOtp} className="w-full">
                                  Verify & Continue
                              </ModernButton>
                          </>
                      )}

                      <button
                          onClick={() => { setIsPhoneMode(false); setIsOtpSent(false); }}
                          className="w-full text-sm font-bold text-slate-400 hover:text-brand-500 transition-colors py-2 mt-4"
                      >
                          Back to email login
                      </button>
                  </div>
              ) : (
                  <div className="space-y-6">
                      <form onSubmit={handleFormSubmit} className="space-y-4">
                          {isLoginMode ? (
                              <ModernInput
                                  type="text"
                                  label="Email or Username"
                                  placeholder="your.name@gmail.com or username"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  icon={<FaEnvelope />}
                              />
                          ) : (
                              <>
                                  <ModernInput
                                      type="email"
                                      label="Email Address (Gmail Only)"
                                      placeholder="your.name@gmail.com"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      icon={<FaEnvelope />}
                                  />
                                  <ModernInput
                                      type="text"
                                      label="Unique Username"
                                      placeholder="Choose a cool username"
                                      value={username}
                                      onChange={(e) => setUsername(e.target.value)}
                                      icon={<FaUserGraduate />}
                                  />
                                  <ModernInput
                                      type="number"
                                      label="Age"
                                      placeholder="Your age"
                                      value={age}
                                      onChange={(e) => setAge(e.target.value)}
                                      icon={<FaMapSigns />} // Using a placeholder icon
                                  />
                              </>
                          )}

                          <ModernInput
                              type="password"
                              label="Password"
                              placeholder="At least 6 characters"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              icon={<FaLock />}
                          />

                          <ModernButton type="submit" className="w-full !mt-8" loading={loading} size="lg">
                              {isLoginMode ? "Sign In" : "Complete Sign Up"}
                          </ModernButton>
                      </form>

                      {/* Divider */}
                      <div className="relative pt-2">
                          <div className="absolute inset-0 flex items-center pt-2"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
                          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-950 px-4 text-slate-400 font-bold tracking-widest">Or continue with</span></div>
                      </div>

                      {/* OAuth Buttons */}
                      <div className="grid grid-cols-2 gap-4">
                          <ModernButton 
                              variant="outline" 
                              className="w-full dark:border-slate-700" 
                              onClick={handleGoogleLogin} 
                              loading={googleLoading}
                              icon={<FaGoogle className="text-red-500" />}
                          >
                              Google
                          </ModernButton>
                          <ModernButton 
                              variant="outline" 
                              className="w-full dark:border-slate-700" 
                              onClick={() => setIsPhoneMode(true)}
                              icon={<FaPhone className="text-brand-500" />}
                          >
                              Phone
                          </ModernButton>
                      </div>

                      <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 pt-4">
                          {isLoginMode ? "Don't have an account?" : "Already have an account?"}{" "}
                          <button
                              onClick={() => {
                                  setIsLoginMode(!isLoginMode);
                                  setFormError(null);
                              }}
                              className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
                          >
                              {isLoginMode ? "Sign Up" : "Sign In"}
                          </button>
                      </p>

                  </div>
              )}
          </div>
      </div>
      <div id="recaptcha-container"></div>
    </div>
  );
}
