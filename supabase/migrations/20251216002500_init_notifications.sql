-- Create Notifications Table
CREATE TYPE notification_type AS ENUM ('match', 'update', 'system');

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'system',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Create a function to easily add notifications (optional helper)
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type notification_type DEFAULT 'system',
    p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_user_id, p_title, p_message, p_type::notification_type, p_link)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
