import { NextResponse } from "next/server";
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  createBrandInvoice,
  createBrandProposal,
  deleteBrandInvoice,
  deleteBrandProposal,
} from "@/lib/db";

export async function GET() {
  try {
    const brands = getBrands();
    return NextResponse.json({ brands });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch brands" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "create_invoice") {
      if (!body.brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
      const invoice = createBrandInvoice(body.brandId, body.invoiceData || {});
      const brands = getBrands();
      return NextResponse.json({ invoice, brands });
    }

    if (body.action === "create_proposal") {
      if (!body.brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
      const proposal = createBrandProposal(body.brandId, body.proposalData || {});
      const brands = getBrands();
      return NextResponse.json({ proposal, brands });
    }

    if (body.action === "update_details" || body.action === "update_brand") {
      if (!body.id && !body.brandId) return NextResponse.json({ error: "Brand ID is required" }, { status: 400 });
      const id = body.id || body.brandId;
      const brand = updateBrand(id, body.data || body);
      const brands = getBrands();
      return NextResponse.json({ brand, brands });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
    }
    const brand = createBrand({
      name: body.name,
      type: body.type,
      status: body.status,
    });
    const brands = getBrands();
    return NextResponse.json({ brand, brands });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process brand request" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = body.id || body.brandId;
    if (!id) return NextResponse.json({ error: "Brand ID is required" }, { status: 400 });
    const brand = updateBrand(id, body);
    const brands = getBrands();
    return NextResponse.json({ brand, brands });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update brand" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const brandId = searchParams.get("brandId");
    const invoiceId = searchParams.get("invoiceId");
    const proposalId = searchParams.get("proposalId");

    if (action === "delete_invoice" && brandId && invoiceId) {
      deleteBrandInvoice(brandId, invoiceId);
      const brands = getBrands();
      return NextResponse.json({ success: true, brands });
    }

    if (action === "delete_proposal" && brandId && proposalId) {
      deleteBrandProposal(brandId, proposalId);
      const brands = getBrands();
      return NextResponse.json({ success: true, brands });
    }

    let id = searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }
    if (!id) {
      return NextResponse.json({ error: "Brand ID is required" }, { status: 400 });
    }
    deleteBrand(id);
    const brands = getBrands();
    return NextResponse.json({ success: true, brands });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete brand resource" }, { status: 500 });
  }
}
