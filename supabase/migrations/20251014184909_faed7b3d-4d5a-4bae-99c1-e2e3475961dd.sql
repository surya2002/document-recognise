-- Add INSERT policy for profiles table to prevent unauthorized profile creation
-- Users can only insert their own profile (where auth.uid() = id)
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);