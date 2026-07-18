export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      exercises: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_seeded: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_seeded?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_seeded?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          date: string
          fat_g: number
          id: string
          logged_at: string
          meal_id: string | null
          name: string
          protein_g: number
          updated_at: string
        }
        Insert: {
          calories: number
          carbs_g?: number
          created_at?: string
          date: string
          fat_g?: number
          id?: string
          logged_at?: string
          meal_id?: string | null
          name?: string
          protein_g?: number
          updated_at?: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          date?: string
          fat_g?: number
          id?: string
          logged_at?: string
          meal_id?: string | null
          name?: string
          protein_g?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          archived_at: string | null
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          id: string
          last_used_at: string | null
          name: string
          protein_g: number
          updated_at: string
          use_count: number
        }
        Insert: {
          archived_at?: string | null
          calories: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          last_used_at?: string | null
          name: string
          protein_g?: number
          updated_at?: string
          use_count?: number
        }
        Update: {
          archived_at?: string | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          last_used_at?: string | null
          name?: string
          protein_g?: number
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      plan_events: {
        Row: {
          action: string
          created_at: string
          date: string
          id: string
          observed_tdee: number | null
          target_before: number | null
          target_suggested: number | null
        }
        Insert: {
          action: string
          created_at?: string
          date: string
          id?: string
          observed_tdee?: number | null
          target_before?: number | null
          target_suggested?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          date?: string
          id?: string
          observed_tdee?: number | null
          target_before?: number | null
          target_suggested?: number | null
        }
        Relationships: []
      }
      profile: {
        Row: {
          appetite: string | null
          birth_date: string | null
          body_fat_pct: number | null
          bulk_style: string | null
          cardio_min_per_week: number | null
          completed_at: string | null
          created_at: string
          height_in: number | null
          id: number
          lift_days_per_week: number | null
          name: string
          neat_tier: string | null
          session_min: number | null
          sex: string
          training_months: number | null
          training_months_as_of: string | null
          updated_at: string
        }
        Insert: {
          appetite?: string | null
          birth_date?: string | null
          body_fat_pct?: number | null
          bulk_style?: string | null
          cardio_min_per_week?: number | null
          completed_at?: string | null
          created_at?: string
          height_in?: number | null
          id?: number
          lift_days_per_week?: number | null
          name?: string
          neat_tier?: string | null
          session_min?: number | null
          sex?: string
          training_months?: number | null
          training_months_as_of?: string | null
          updated_at?: string
        }
        Update: {
          appetite?: string | null
          birth_date?: string | null
          body_fat_pct?: number | null
          bulk_style?: string | null
          cardio_min_per_week?: number | null
          completed_at?: string | null
          created_at?: string
          height_in?: number | null
          id?: number
          lift_days_per_week?: number | null
          name?: string
          neat_tier?: string | null
          session_min?: number | null
          sex?: string
          training_months?: number | null
          training_months_as_of?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          calorie_target: number
          carb_target_g: number
          created_at: string
          fat_target_g: number
          goal_rate_lbs_per_week: number
          goal_rate_source: string
          goal_weight_lbs: number | null
          id: number
          protein_target_g: number
          updated_at: string
        }
        Insert: {
          calorie_target?: number
          carb_target_g?: number
          created_at?: string
          fat_target_g?: number
          goal_rate_lbs_per_week?: number
          goal_rate_source?: string
          goal_weight_lbs?: number | null
          id?: number
          protein_target_g?: number
          updated_at?: string
        }
        Update: {
          calorie_target?: number
          carb_target_g?: number
          created_at?: string
          fat_target_g?: number
          goal_rate_lbs_per_week?: number
          goal_rate_source?: string
          goal_weight_lbs?: number | null
          id?: number
          protein_target_g?: number
          updated_at?: string
        }
        Relationships: []
      }
      target_history: {
        Row: {
          calorie_target: number
          carb_target_g: number
          created_at: string
          effective_date: string
          fat_target_g: number
          protein_target_g: number
          updated_at: string
        }
        Insert: {
          calorie_target: number
          carb_target_g: number
          created_at?: string
          effective_date: string
          fat_target_g: number
          protein_target_g: number
          updated_at?: string
        }
        Update: {
          calorie_target?: number
          carb_target_g?: number
          created_at?: string
          effective_date?: string
          fat_target_g?: number
          protein_target_g?: number
          updated_at?: string
        }
        Relationships: []
      }
      weigh_ins: {
        Row: {
          created_at: string
          date: string
          updated_at: string
          weight_lbs: number
        }
        Insert: {
          created_at?: string
          date: string
          updated_at?: string
          weight_lbs: number
        }
        Update: {
          created_at?: string
          date?: string
          updated_at?: string
          weight_lbs?: number
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          created_at: string
          date: string
          exercise_id: string
          id: string
          reps: number
          set_number: number
          updated_at: string
          weight_lbs: number
        }
        Insert: {
          created_at?: string
          date: string
          exercise_id: string
          id?: string
          reps: number
          set_number: number
          updated_at?: string
          weight_lbs: number
        }
        Update: {
          created_at?: string
          date?: string
          exercise_id?: string
          id?: string
          reps?: number
          set_number?: number
          updated_at?: string
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_targets: {
        Args: {
          p_action?: string
          p_calorie_target: number
          p_carb_target_g: number
          p_effective_date: string
          p_fat_target_g: number
          p_goal_rate_lbs_per_week?: number
          p_goal_rate_source?: string
          p_goal_weight_lbs?: number
          p_observed_tdee?: number
          p_protein_target_g: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
