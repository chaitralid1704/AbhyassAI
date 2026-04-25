export const saveUserToFirestore = async (user: any, role: string = "student", username: string | null = null, age: string | null = null) => {
  if (!user) return;

  try {
    const response = await fetch("http://localhost:8000/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email || null,
        phone: user.phoneNumber || null,
        name: user.displayName || "User",
        role: role,
        username: username,
        age: age ? parseInt(age) : null,
      }),
    });

    if (!response.ok) {
      console.error("Failed to save user to Python backend", await response.text());
    } else {
      console.log("User successfully saved to backend");
    }
  } catch (error) {
    console.error("Error connecting to Python backend:", error);
  }
};