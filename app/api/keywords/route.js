import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("keywords")
      .select(`
        *,
        monitored_accounts (
          id,
          name,
          handle,
          platform
        )
      `)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      keywords: data || [],
    });
  } catch (error) {
    console.error("keywords GET:", error);

    return NextResponse.json(
      {
        error: "キーワードを取得できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  try {
    const body =
      await request.json();

    const word =
      String(body.word || "").trim();

    const accountId =
      body.account_id || null;

    if (!word) {
      return NextResponse.json(
        {
          error: "キーワードを入力してください",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getSupabaseAdmin();

    let query = supabase
      .from("keywords")
      .select("id, word, account_id")
      .ilike("word", word);

    if (accountId) {
      query = query.eq(
        "account_id",
        accountId
      );
    } else {
      query = query.is(
        "account_id",
        null
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await query;

    if (existingError) {
      throw existingError;
    }

    if (existing?.length) {
      return NextResponse.json(
        {
          error:
            "同じキーワードがすでに登録されています",
        },
        {
          status: 409,
        }
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("keywords")
      .insert({
        word,
        account_id: accountId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      keyword: data,
    });
  } catch (error) {
    console.error(
      "keywords POST:",
      error
    );

    return NextResponse.json(
      {
        error:
          "キーワードを登録できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } =
      new URL(request.url);

    const id =
      searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          error: "id が必要です",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const { error } =
      await supabase
        .from("keywords")
        .delete()
        .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "keywords DELETE:",
      error
    );

    return NextResponse.json(
      {
        error:
          "キーワードを削除できませんでした",
      },
      {
        status: 500,
      }
    );
  }
}
